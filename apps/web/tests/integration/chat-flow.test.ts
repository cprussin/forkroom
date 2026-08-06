import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Pool } from "pg";
import { createMockModel } from "../../src/server/generation/model/mock";
import { runGeneration } from "../../src/server/generation/run-generation";
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
