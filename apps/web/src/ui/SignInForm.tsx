"use client";

import { Button } from "@forkroom/component-library/Button";
import { Input } from "@forkroom/component-library/Input";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { css } from "../../styled-system/css";

/**
 * Sign-in. The email-only development credentials path is low-friction for
 * local multi-user testing; "Continue with GitHub" is available when OAuth is
 * configured in the environment.
 */
export const SignInForm = ({ callbackUrl }: { callbackUrl: string }) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const devSignIn = () => {
    signIn("credentials", { email, name, redirectTo: callbackUrl }).catch(
      (reason: unknown) => {
        // biome-ignore lint/suspicious/noConsole: surface sign-in failure
        console.error("sign in failed", reason);
      },
    );
  };

  const githubSignIn = () => {
    signIn("github", { redirectTo: callbackUrl }).catch((reason: unknown) => {
      // biome-ignore lint/suspicious/noConsole: surface sign-in failure
      console.error("github sign in failed", reason);
    });
  };

  return (
    <>
      <div>
        <h1 className={headingStyles}>Sign in to forkroom</h1>
        <p className={subStyles}>
          Use email for local testing, or GitHub in production.
        </p>
      </div>
      <div className={fieldsStyles}>
        <Input
          aria-label="Email"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        <Input
          aria-label="Display name (optional)"
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Display name (optional)"
          value={name}
        />
        <Button
          disabled={email.trim().length === 0}
          onClick={devSignIn}
          variant="primary"
        >
          Continue with email
        </Button>
      </div>
      <div className={dividerStyles}>or</div>
      <Button onClick={githubSignIn} variant="outline">
        Continue with GitHub
      </Button>
    </>
  );
};

const headingStyles = css({ fontSize: "2xl", fontWeight: "bold" });
const subStyles = css({ color: "muted", fontSize: "sm", marginBlockStart: 1 });
const fieldsStyles = css({ display: "flex", flexDirection: "column", gap: 2 });
const dividerStyles = css({
  color: "muted",
  fontSize: "xs",
  textAlign: "center",
  textTransform: "uppercase",
});
