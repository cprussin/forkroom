import { z } from "zod";
import { queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";
import { newId } from "../domain/ids";

const userSchema = z.object({
  avatarUrl: z.string().nullable(),
  displayName: z.string(),
  email: z.string(),
  id: z.string(),
});
export type UserRecord = z.infer<typeof userSchema>;

/**
 * Upsert the authenticated user's profile, keyed by email (the auth identity).
 * Called from the auth callback so a signed-in user always has a `users` row
 * that chat rows can reference.
 */
export const upsertUser = (
  db: Queryable,
  profile: {
    email: string;
    displayName: string;
    avatarUrl: string | undefined;
  },
): Promise<UserRecord> =>
  queryOne(
    db,
    userSchema,
    `INSERT INTO users (id, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = now()
     RETURNING id AS "id", email AS "email", display_name AS "displayName", avatar_url AS "avatarUrl"`,
    [newId(), profile.email, profile.displayName, profile.avatarUrl ?? null],
  );

export const getUserByEmail = async (
  db: Queryable,
  email: string,
): Promise<UserRecord | undefined> => {
  const rows = await queryRows(
    db,
    userSchema,
    `SELECT id AS "id", email AS "email", display_name AS "displayName", avatar_url AS "avatarUrl"
       FROM users WHERE email = $1`,
    [email],
  );
  const [row] = rows;
  return row;
};
