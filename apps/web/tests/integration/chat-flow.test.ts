import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createMockModel } from "../../src/server/generation/model/mock";
import type { ChatModel } from "../../src/server/generation/model/provider";
import { runGeneration } from "../../src/server/generation/run-generation";
import { getBranch } from "../../src/server/repositories/branches";
import { getChatMeta } from "../../src/server/repositories/chats";
import { getMemberRole } from "../../src/server/repositories/members";
import { listMessages } from "../../src/server/repositories/messages";
import { getChatSnapshot } from "../../src/server/repositories/snapshot";
import { upsertUser } from "../../src/server/repositories/users";
import { createChat } from "../../src/server/services/create-chat";
import { acceptInvite, createInvite } from "../../src/server/services/invites";
import { submitPrompt } from "../../src/server/services/submit-prompt";

// Integration tests need a real Postgres. Provide DATABASE_URL to run them;
// otherwise they are skipped (unit tests always run without a database).
const databaseUrl = Bun.env.DATABASE_URL;
const pool =
  databaseUrl === undefined
    ? undefined
    : new Pool({ connectionString: databaseUrl });

const deps = { maxPromptChars: 16_000, model: "mock-1", provider: "mock" };
const genDeps = { model: createMockModel(), systemPrompt: "You are a test." };

const run = pool === undefined ? describe.skip : describe;

const newUser = async (db: Pool, email: string): Promise<string> => {
  const record = await upsertUser(db, {
    avatarUrl: undefined,
    displayName: email,
    email,
  });
  return record.id;
};

run("chat flow (integration)", () => {
  let db: Pool;

  beforeAll(() => {
    if (pool === undefined) {
      throw new Error("unreachable: suite skipped without a pool");
    }
    db = pool;
  });

  beforeEach(async () => {
    await db.query(
      `TRUNCATE users, chats, chat_members, chat_invites, branches, messages,
         generations, prompt_requests, outbox_events, generation_jobs, audit_log
       RESTART IDENTITY CASCADE`,
    );
  });

  it("creates a chat, its creator membership, and its main branch atomically", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Test chat", userId: creator },
      db,
    );

    const meta = await getChatMeta(db, chatId);
    expect(meta?.mainBranchId).toBe(mainBranchId);
    expect(await getMemberRole(db, chatId, creator)).toBeDefined();
  });

  it("appends the creator's prompt to main and runs its generation", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );

    const result = await submitPrompt(
      {
        body: {
          content: "Hello",
          expectedTipMessageId: null,
          idempotencyKey: "k1",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: creator,
      },
      deps,
      db,
    );
    const response = result.match({
      Err: (error) => {
        throw new Error(`unexpected error ${error.code}`);
      },
      Ok: (value) => value,
    });
    expect(response.mode).toBe("appended");
    expect(response.branchId).toBe(mainBranchId);

    await runGeneration(
      response.generationId,
      genDeps,
      new AbortController().signal,
      db,
    );

    const messages = await listMessages(db, chatId);
    const assistant = messages.find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("completed");
    expect((assistant?.content.length ?? 0) > 0).toBe(true);
  });

  it("forks a participant submission from main without mutating main", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const participant = await newUser(db, "participant@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );

    // Creator seeds main with one exchange.
    const seed = await submitPrompt(
      {
        body: {
          content: "Main message",
          expectedTipMessageId: null,
          idempotencyKey: "seed",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: creator,
      },
      deps,
      db,
    );
    const seedResponse = seed.match({
      Err: () => {
        throw new Error("seed failed");
      },
      Ok: (value) => value,
    });
    await runGeneration(
      seedResponse.generationId,
      genDeps,
      new AbortController().signal,
      db,
    );

    const mainBefore = (await listMessages(db, chatId)).filter(
      (m) => m.branchId === mainBranchId,
    ).length;

    // Participant accepts an invite, then submits from main → fork.
    const invite = await createInvite({ chatId, userId: creator }, db);
    const token = invite.match({
      Err: () => {
        throw new Error("invite failed");
      },
      Ok: (value) => value.token,
    });
    await acceptInvite({ token, userId: participant }, db);

    const mainTip = (await listMessages(db, chatId))
      .filter((m) => m.branchId === mainBranchId)
      .at(-1);
    const forkResult = await submitPrompt(
      {
        body: {
          content: "Participant question",
          expectedTipMessageId: mainTip?.id ?? null,
          idempotencyKey: "fork1",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: participant,
      },
      deps,
      db,
    );
    const forkResponse = forkResult.match({
      Err: (error) => {
        throw new Error(`fork failed ${error.code}`);
      },
      Ok: (value) => value,
    });

    expect(forkResponse.mode).toBe("forked");
    expect(forkResponse.branchId).not.toBe(mainBranchId);
    expect(forkResponse.parentBranchId).toBe(mainBranchId);

    const mainAfter = (await listMessages(db, chatId)).filter(
      (m) => m.branchId === mainBranchId,
    ).length;
    expect(mainAfter).toBe(mainBefore);
  });

  it("lets a branch owner continue their branch without forking again", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const participant = await newUser(db, "participant@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );
    const invite = await createInvite({ chatId, userId: creator }, db);
    const token = invite.match({ Err: () => "", Ok: (v) => v.token });
    await acceptInvite({ token, userId: participant }, db);

    const fork = await submitPrompt(
      {
        body: {
          content: "first",
          expectedTipMessageId: null,
          idempotencyKey: "f1",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: participant,
      },
      deps,
      db,
    );
    const forked = fork.match({
      Err: () => {
        throw new Error("fork failed");
      },
      Ok: (v) => v,
    });
    await runGeneration(
      forked.generationId,
      genDeps,
      new AbortController().signal,
      db,
    );

    const tip = (await listMessages(db, chatId))
      .filter((m) => m.branchId === forked.branchId)
      .at(-1);
    const cont = await submitPrompt(
      {
        body: {
          content: "second",
          expectedTipMessageId: tip?.id ?? null,
          idempotencyKey: "f2",
          selectedBranchId: forked.branchId,
        },
        chatId,
        userId: participant,
      },
      deps,
      db,
    );
    const continued = cont.match({
      Err: (e) => {
        throw new Error(`continue failed ${e.code}`);
      },
      Ok: (v) => v,
    });
    expect(continued.mode).toBe("appended");
    expect(continued.branchId).toBe(forked.branchId);
  });

  it("forks from a chosen point in history, leaving later messages intact", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );

    // Creator seeds main with two exchanges.
    const runExchange = async (content: string, key: string) => {
      const tip = (await listMessages(db, chatId))
        .filter((m) => m.branchId === mainBranchId)
        .at(-1);
      const result = await submitPrompt(
        {
          body: {
            content,
            expectedTipMessageId: tip?.id ?? null,
            idempotencyKey: key,
            selectedBranchId: mainBranchId,
          },
          chatId,
          userId: creator,
        },
        deps,
        db,
      );
      const response = result.match({
        Err: (error) => {
          throw new Error(`submit failed ${error.code}`);
        },
        Ok: (value) => value,
      });
      await runGeneration(
        response.generationId,
        genDeps,
        new AbortController().signal,
        db,
      );
    };
    await runExchange("first", "e1");
    await runExchange("second", "e2");

    const mainMessages = (await listMessages(db, chatId)).filter(
      (m) => m.branchId === mainBranchId,
    );
    // Fork from the first assistant reply, before the second exchange.
    const firstAssistant = mainMessages.find(
      (m) => m.role === "assistant" && m.status === "completed",
    );
    const currentTip = mainMessages.at(-1);
    const forkResult = await submitPrompt(
      {
        body: {
          content: "a different direction",
          expectedTipMessageId: currentTip?.id ?? null,
          forkPointMessageId: firstAssistant?.id ?? null,
          idempotencyKey: "history-fork",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: creator,
      },
      deps,
      db,
    );
    const forked = forkResult.match({
      Err: (error) => {
        throw new Error(`history fork failed ${error.code}`);
      },
      Ok: (value) => value,
    });

    expect(forked.mode).toBe("forked");
    expect(forked.branchId).not.toBe(mainBranchId);
    expect(forked.parentBranchId).toBe(mainBranchId);
    expect(forked.forkMessageId).toBe(firstAssistant?.id ?? null);
    // Main keeps both of its exchanges (4 messages) — the fork is additive.
    const mainAfter = (await listMessages(db, chatId)).filter(
      (m) => m.branchId === mainBranchId,
    );
    expect(mainAfter.length).toBe(mainMessages.length);
  });

  it("lets the creator fork a branch owned by another member", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const participant = await newUser(db, "participant@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );
    const invite = await createInvite({ chatId, userId: creator }, db);
    const token = invite.match({ Err: () => "", Ok: (v) => v.token });
    await acceptInvite({ token, userId: participant }, db);

    // Participant forks a branch of their own from main.
    const fork = await submitPrompt(
      {
        body: {
          content: "participant fork",
          expectedTipMessageId: null,
          idempotencyKey: "p1",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: participant,
      },
      deps,
      db,
    );
    const forkedResponse = fork.match({
      Err: () => {
        throw new Error("participant fork failed");
      },
      Ok: (v) => v,
    });
    const participantBranch = forkedResponse.branchId;
    await runGeneration(
      forkedResponse.generationId,
      genDeps,
      new AbortController().signal,
      db,
    );

    // The creator submits on the participant's branch → a new fork owned by the
    // creator, never an append to someone else's branch.
    const participantTip = (await listMessages(db, chatId))
      .filter((m) => m.branchId === participantBranch)
      .at(-1);
    const creatorFork = await submitPrompt(
      {
        body: {
          content: "creator's take",
          expectedTipMessageId: participantTip?.id ?? null,
          idempotencyKey: "c1",
          selectedBranchId: participantBranch,
        },
        chatId,
        userId: creator,
      },
      deps,
      db,
    );
    const creatorResponse = creatorFork.match({
      Err: (error) => {
        throw new Error(`creator fork failed ${error.code}`);
      },
      Ok: (v) => v,
    });

    expect(creatorResponse.mode).toBe("forked");
    expect(creatorResponse.parentBranchId).toBe(participantBranch);
    const newBranch = await getBranch(db, chatId, creatorResponse.branchId);
    expect(newBranch?.ownerUserId).toBe(creator);
  });

  it("marks a generation failed when the model errors before emitting text", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );
    const submitted = await submitPrompt(
      {
        body: {
          content: "Hello",
          expectedTipMessageId: null,
          idempotencyKey: "fail-1",
          selectedBranchId: mainBranchId,
        },
        chatId,
        userId: creator,
      },
      deps,
      db,
    );
    const generationId = submitted.match({
      Err: () => {
        throw new Error("submit failed");
      },
      Ok: (value) => value.generationId,
    });

    // A model that rejects before yielding any text — the assistant placeholder
    // stays empty, so failing must still be persistable (not blocked by the
    // content constraint) and must not wedge the generation at "streaming".
    const failingModel: ChatModel = {
      model: "mock-1",
      provider: "mock",
      stream: () => ({
        [Symbol.asyncIterator](): AsyncIterator<{ textDelta: string }> {
          return { next: () => Promise.reject(new Error("boom")) };
        },
      }),
    };

    await runGeneration(
      generationId,
      { model: failingModel, systemPrompt: "x" },
      new AbortController().signal,
      db,
    );

    const generation = await db.query(
      "SELECT status, error_code FROM generations WHERE id = $1",
      [generationId],
    );
    expect((generation.rows[0] as { status: string }).status).toBe("failed");

    const assistant = (await listMessages(db, chatId)).find(
      (m) => m.role === "assistant",
    );
    expect(assistant?.status).toBe("failed");
  });

  it("replays an idempotent request without creating duplicates", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );
    const body = {
      content: "once",
      expectedTipMessageId: null,
      idempotencyKey: "same-key",
      selectedBranchId: mainBranchId,
    };
    const first = await submitPrompt(
      { body, chatId, userId: creator },
      deps,
      db,
    );
    const second = await submitPrompt(
      { body, chatId, userId: creator },
      deps,
      db,
    );

    const firstId = first.match({ Err: () => "", Ok: (v) => v.generationId });
    const secondId = second.match({ Err: () => "", Ok: (v) => v.generationId });
    expect(secondId).toBe(firstId);

    const generations = await db.query("SELECT count(*) AS n FROM generations");
    expect(Number((generations.rows[0] as { n: string }).n)).toBe(1);
  });

  it("rejects a second append to the same branch tip", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const { chatId, mainBranchId } = await createChat(
      { title: "Chat", userId: creator },
      db,
    );
    const base = {
      content: "x",
      expectedTipMessageId: null,
      selectedBranchId: mainBranchId,
    };
    const [a, b] = await Promise.all([
      submitPrompt(
        { body: { ...base, idempotencyKey: "a" }, chatId, userId: creator },
        deps,
        db,
      ),
      submitPrompt(
        { body: { ...base, idempotencyKey: "b" }, chatId, userId: creator },
        deps,
        db,
      ),
    ]);
    const oks = [a, b].filter((result) => result.isOk()).length;
    expect(oks).toBe(1);
  });

  it("denies snapshot access to a non-member", async () => {
    const creator = await newUser(db, "creator@test.dev");
    const outsider = await newUser(db, "outsider@test.dev");
    const { chatId } = await createChat({ title: "Chat", userId: creator }, db);
    const role = await getMemberRole(db, chatId, outsider);
    expect(role).toBeUndefined();
    // A member does get a snapshot.
    const creatorRole = await getMemberRole(db, chatId, creator);
    expect(creatorRole).toBeDefined();
    if (creatorRole !== undefined) {
      const snapshot = await getChatSnapshot(db, chatId, creator, creatorRole);
      expect(snapshot?.branches.length).toBe(1);
    }
  });
});
