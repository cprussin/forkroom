import { Button } from "@forkroom/component-library/Button";
import { css } from "../../styled-system/css";
import { getSessionUserId } from "../server/http/session-user";
import { CenteredPanel } from "../ui/CenteredPanel";
import { CreateChatForm } from "../ui/CreateChatForm";

const HomePage = async () => {
  const userId = await getSessionUserId();
  return (
    <CenteredPanel>
      {userId === undefined ? (
        <>
          <div>
            <h1 className={headingStyles}>forkroom</h1>
            <p className={subStyles}>
              Collaborative AI chat where every participant&apos;s reply forks
              its own branch. Sign in to start or join a chat.
            </p>
          </div>
          <Button href="/signin" variant="primary">
            Sign in
          </Button>
        </>
      ) : (
        <CreateChatForm />
      )}
    </CenteredPanel>
  );
};

export default HomePage;

const headingStyles = css({ fontSize: "3xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 2 });
