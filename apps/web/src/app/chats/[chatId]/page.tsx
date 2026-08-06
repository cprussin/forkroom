import { redirect } from "next/navigation";
import { css } from "../../../../styled-system/css";
import { getPool } from "../../../server/db/pool";
import { getSessionUserId } from "../../../server/http/session-user";
import { getMemberRole } from "../../../server/repositories/members";
import { getChatSnapshot } from "../../../server/repositories/snapshot";
import { Board } from "../../../ui/Board";
import { CenteredPanel } from "../../../ui/CenteredPanel";

// The chat board reads live per-request data; never statically cache.
export const dynamic = "force-dynamic";

const ChatPage = async ({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) => {
  const { chatId } = await params;
  const userId = await getSessionUserId();
  if (userId === undefined) {
    redirect(`/signin?callbackUrl=/chats/${chatId}`);
  }

  const role = await getMemberRole(getPool(), chatId, userId);
  if (role === undefined) {
    return (
      <CenteredPanel>
        <h1 className={headingStyles}>Access denied</h1>
        <p className={subStyles}>
          You don&apos;t have access to this chat. Ask the creator for an
          invitation link.
        </p>
      </CenteredPanel>
    );
  }

  const snapshot = await getChatSnapshot(getPool(), chatId, userId, role);
  if (snapshot === undefined) {
    return (
      <CenteredPanel>
        <h1 className={headingStyles}>Chat not found</h1>
      </CenteredPanel>
    );
  }

  return <Board snapshot={snapshot} />;
};

export default ChatPage;

const headingStyles = css({ fontSize: "2xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 2 });
