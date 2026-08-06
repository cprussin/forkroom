"use client";

import { Provider } from "@forkroom/component-library/Provider";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client-side context roots: Auth.js session and the component library's
 * provider (theme controller). Mounted once around the app.
 */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <SessionProvider>
    <Provider>{children}</Provider>
  </SessionProvider>
);
