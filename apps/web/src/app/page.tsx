import { Button } from "@forkroom/component-library/Button";
import { css } from "../../styled-system/css";
import { getPool } from "../server/db/pool";
import { getSessionUserId } from "../server/http/session-user";
import { listChatsForUser } from "../server/repositories/chats";
import { AppShell } from "../ui/AppShell";
import { CenteredPanel } from "../ui/CenteredPanel";
import { NewChatComposer } from "../ui/NewChatComposer";

// Reads the signed-in user's chats per request; never statically cache.
export const dynamic = "force-dynamic";

const HomePage = async () => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return (
      <CenteredPanel>
        <div>
          <h1 className={signedOutHeadingStyles}>forkroom</h1>
          <p className={subStyles}>
            Collaborative AI chat where every participant&apos;s reply forks its
            own branch. Sign in to start or join a chat.
          </p>
        </div>
        <Button href="/signin" variant="primary">
          Sign in
        </Button>
      </CenteredPanel>
    );
  } else {
    const chats = await listChatsForUser(getPool(), userId);
    return (
      <AppShell chats={chats} currentChatId={undefined}>
        <div className={homeStyles}>
          <h1 className={headingStyles}>What can I help with?</h1>
          <NewChatComposer />
        </div>
      </AppShell>
    );
  }
};

export default HomePage;

const homeStyles = css({
  alignItems: "center",
  blockSize: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  justifyContent: "center",
  paddingBlock: 6,
  paddingInline: 4,
});

const headingStyles = css({
  fontSize: "2xl",
  fontWeight: "semibold",
  textAlign: "center",
});

const signedOutHeadingStyles = css({ fontSize: "3xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 2 });
