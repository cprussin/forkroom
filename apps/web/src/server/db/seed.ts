import { upsertUser } from "../repositories/users";
import { createChat } from "../services/create-chat";
import { createInvite } from "../services/invites";
import { getPool } from "./pool";

/**
 * `bun run db:seed` — a minimal two-user demo. Creates Alice (creator) and Bob,
 * one chat, and an invite link Bob can accept. Prints sign-in details so a local
 * two-session walkthrough (PRD §18) needs no manual setup.
 */
const main = async (): Promise<void> => {
  const pool = getPool();
  const alice = await upsertUser(pool, {
    avatarUrl: undefined,
    displayName: "Alice",
    email: "alice@example.com",
  });
  await upsertUser(pool, {
    avatarUrl: undefined,
    displayName: "Bob",
    email: "bob@example.com",
  });

  const { chatId } = await createChat(
    { title: "Demo: weekend trip ideas", userId: alice.id },
    pool,
  );
  const invite = await createInvite({ chatId, userId: alice.id }, pool);
  const token = invite.match({
    Err: (error) => {
      throw new Error(`failed to create demo invite: ${error.code}`);
    },
    Ok: (value) => value.token,
  });

  // biome-ignore lint/suspicious/noConsole: seed CLI output
  console.log(
    [
      "Seed complete.",
      "",
      "Sign in (email only, dev credentials):",
      "  Creator: alice@example.com",
      "  Guest:   bob@example.com",
      "",
      `Chat:   /chats/${chatId}`,
      `Invite: /invite/${token}`,
    ].join("\n"),
  );
  await pool.end();
};

await main();
