import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { z } from "zod";
import { getPool } from "../db/pool";
import { getServerEnv } from "../env";
import { upsertUser } from "../repositories/users";

const devCredentialsSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

/**
 * Auth.js configuration. Two sign-in paths:
 *
 *   - **Development credentials** — a low-friction email-only sign-in (no
 *     password) so a second browser session can join a chat locally.
 *   - **GitHub OAuth** — enabled in production when `AUTH_GITHUB_ID` /
 *     `AUTH_GITHUB_SECRET` are set.
 *
 * Sessions are JWT-based (no database adapter). Every sign-in upserts a row in
 * our own `users` table and the user's id is carried on the token, so server
 * code derives identity from the session — never a client-supplied id (§7.1).
 */
const buildConfig = (): NextAuthConfig => {
  const env = getServerEnv();
  const github =
    env.AUTH_GITHUB_ID !== undefined && env.AUTH_GITHUB_SECRET !== undefined
      ? [
          GitHub({
            clientId: env.AUTH_GITHUB_ID,
            clientSecret: env.AUTH_GITHUB_SECRET,
          }),
        ]
      : [];

  return {
    callbacks: {
      // On sign-in, upsert the user into our own table and pin our id onto the
      // token's standard `sub` claim, so every subsequent request derives
      // identity from the session rather than a provider-specific id.
      jwt: async ({ token, user }) => {
        if (user?.email !== undefined && user.email !== null) {
          const record = await upsertUser(getPool(), {
            avatarUrl: user.image ?? undefined,
            displayName: user.name ?? user.email,
            email: user.email,
          });
          token.sub = record.id;
        }
        return token;
      },
      session: ({ session, token }) => {
        if (token.sub !== undefined) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
    providers: [
      ...github,
      Credentials({
        authorize: async (raw) => {
          const parsed = devCredentialsSchema.safeParse(raw);
          if (parsed.success) {
            const record = await upsertUser(getPool(), {
              avatarUrl: undefined,
              displayName: parsed.data.name ?? parsed.data.email,
              email: parsed.data.email,
            });
            return {
              email: record.email,
              id: record.id,
              name: record.displayName,
            };
          } else {
            return null;
          }
        },
        credentials: { email: {}, name: {} },
        name: "Development sign-in",
      }),
    ],
    secret: env.AUTH_SECRET,
    session: { strategy: "jwt" },
  };
};

// Only `auth` and `handlers` are re-exported; the client uses `next-auth/react`
// for sign-in/out. (Re-exporting `signIn`/`signOut` here forces a non-portable
// inferred type from `@auth/core`.)
export const { auth, handlers } = NextAuth(buildConfig);
