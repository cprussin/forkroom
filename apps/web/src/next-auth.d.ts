import type { DefaultSession } from "next-auth";

// Carry our own user id on the session and token so server code reads identity
// from the authenticated session, never from client input.
declare module "next-auth" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation requires an interface
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
