import { redirect } from "next/navigation";
import { getSessionUserId } from "../../server/http/session-user";
import { CenteredPanel } from "../../ui/CenteredPanel";
import { SignInForm } from "../../ui/SignInForm";

const SignInPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) => {
  const params = await searchParams;
  const raw = params.callbackUrl;
  const callbackUrl = typeof raw === "string" ? raw : "/";
  const userId = await getSessionUserId();
  if (userId !== undefined) {
    redirect(callbackUrl);
  }
  return (
    <CenteredPanel>
      <SignInForm callbackUrl={callbackUrl} />
    </CenteredPanel>
  );
};

export default SignInPage;
