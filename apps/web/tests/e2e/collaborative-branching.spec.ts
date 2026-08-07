import { expect, test } from "@playwright/test";

/**
 * Two isolated browser sessions exercise the core collaborative-branching
 * journey (PRD §15): the creator prompts on main, invites a participant, and the
 * participant's submission forks a new branch visible to both — without mutating
 * main.
 *
 * Requires a running stack: a migrated database, the web app, and a worker (or
 * the `/api/worker/tick` cron) draining generations. With `MODEL_PROVIDER=mock`
 * no API key is needed. See `tests/e2e/README.md`.
 */

const signIn = async (
  page: import("@playwright/test").Page,
  email: string,
): Promise<void> => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.waitForURL("**/");
};

test("creator prompts on main, participant forks a branch", async ({
  browser,
}) => {
  const creatorContext = await browser.newContext();
  const participantContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const participant = await participantContext.newPage();

  // Creator signs in and starts a chat.
  await signIn(creator, `creator+${Date.now().toString()}@example.com`);
  await creator.getByLabel("Chat title").fill("E2E branching");
  await creator.getByRole("button", { name: "Create" }).click();
  await creator.waitForURL("**/chats/**");

  // Creator prompts on main and sees a streamed reply complete.
  await creator.getByLabel("Message").fill("Hello from the creator");
  await creator.getByRole("button", { name: "Send" }).click();
  await expect(creator.getByText("Hello from the creator")).toBeVisible();
  await expect(creator.getByText(/mock assistant reply/i)).toBeVisible({
    timeout: 15_000,
  });

  // Creator generates an invite link.
  await creator.getByRole("button", { name: "Invite" }).click();
  await creator.getByRole("button", { name: "Generate invite link" }).click();
  const inviteLink = await creator.getByRole("code").innerText();
  const invitePath = new URL(inviteLink).pathname;

  // Participant signs in and accepts the invite.
  await signIn(participant, `participant+${Date.now().toString()}@example.com`);
  await participant.goto(invitePath);
  await participant.getByRole("button", { name: /Accept/ }).click();
  await participant.waitForURL("**/chats/**");
  await expect(participant.getByText("Hello from the creator")).toBeVisible();

  // Participant submits on main (owned by the creator) → a new fork is created
  // and the view switches to it, showing the participant's message.
  await participant.getByLabel("Message").fill("A participant question");
  await participant.getByRole("button", { name: "Fork" }).click();
  await expect(participant.getByText("A participant question")).toBeVisible();

  // The creator, still on main, sees a fork switcher appear on the forked
  // message and can switch to the participant's fork to read it.
  await expect(creator.getByRole("button", { name: /next fork/i })).toBeVisible(
    { timeout: 15_000 },
  );
  await creator.getByRole("button", { name: /next fork/i }).click();
  await expect(creator.getByText("A participant question")).toBeVisible();

  await creatorContext.close();
  await participantContext.close();
});
