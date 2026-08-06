import { css } from "../../../../styled-system/css";
import { previewInvite } from "../../../server/services/invites";
import { AcceptInvite } from "../../../ui/AcceptInvite";
import { CenteredPanel } from "../../../ui/CenteredPanel";

export const dynamic = "force-dynamic";

const InvitePage = async ({
  params,
}: {
  params: Promise<{ token: string }>;
}) => {
  const { token } = await params;
  const preview = await previewInvite({ token });
  return (
    <CenteredPanel>
      {preview.match({
        Err: (error) => (
          <>
            <h1 className={headingStyles}>Invitation unavailable</h1>
            <p className={subStyles}>{error.title}</p>
          </>
        ),
        Ok: (data) => (
          <AcceptInvite
            chatTitle={data.chatTitle}
            creatorDisplayName={data.creatorDisplayName}
            token={token}
          />
        ),
      })}
    </CenteredPanel>
  );
};

export default InvitePage;

const headingStyles = css({ fontSize: "2xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 2 });
