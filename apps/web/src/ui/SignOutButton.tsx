"use client";

import { Button } from "@forkroom/component-library/Button";
import { signOut } from "next-auth/react";

export const SignOutButton = () => (
  <Button
    onClick={() => {
      signOut({ redirectTo: "/" }).catch((reason: unknown) => {
        // biome-ignore lint/suspicious/noConsole: surface sign-out failure
        console.error("sign out failed", reason);
      });
    }}
    size="sm"
    variant="ghost"
  >
    Sign out
  </Button>
);
