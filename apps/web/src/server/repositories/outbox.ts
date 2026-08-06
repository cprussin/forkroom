import { z } from "zod";
import type { ChatEvent } from "../../contracts/chat-events";
import { chatEventSchema } from "../../contracts/chat-events";
import { execute, queryOne, queryRows } from "../db/client";
import type { Queryable } from "../db/pool";

/**
 * Append a client-safe event to the transactional outbox. Called inside the
 * same transaction as the change it describes, so a committed change always has
 * its event durably queued. `payload` holds the event-type-specific fields; the
 * publisher reassembles the full `ChatEvent` from the row's id, chat, and type.
 */
export const appendOutboxEvent = async (
  db: Queryable,
  chatId: string,
  eventType: string,
  aggregateId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO outbox_events (chat_id, event_type, aggregate_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [chatId, eventType, aggregateId ?? null, JSON.stringify(payload)],
  );
};

const outboxRowSchema = z.object({
  chatId: z.string(),
  eventType: z.string(),
  id: z.coerce.number(),
  payload: z.record(z.string(), z.unknown()),
});

const toChatEvent = (row: z.infer<typeof outboxRowSchema>): ChatEvent =>
  chatEventSchema.parse({
    chatId: row.chatId,
    id: row.id,
    type: row.eventType,
    ...row.payload,
  });

/** Fetch a batch of a chat's events after a cursor, oldest first. */
export const fetchEventsAfter = async (
  db: Queryable,
  chatId: string,
  afterId: number,
  limit: number,
): Promise<ChatEvent[]> => {
  const rows = await queryRows(
    db,
    outboxRowSchema,
    `SELECT id AS "id", chat_id AS "chatId", event_type AS "eventType", payload AS "payload"
       FROM outbox_events
      WHERE chat_id = $1 AND id > $2
      ORDER BY id ASC
      LIMIT $3`,
    [chatId, afterId, limit],
  );
  return rows.map(toChatEvent);
};

/** Fetch a global batch of unpublished events for the background publisher. */
export const fetchUnpublished = async (
  db: Queryable,
  limit: number,
): Promise<{ events: ChatEvent[]; lastId: number }> => {
  const rows = await queryRows(
    db,
    outboxRowSchema,
    `SELECT id AS "id", chat_id AS "chatId", event_type AS "eventType", payload AS "payload"
       FROM outbox_events
      WHERE published_at IS NULL
      ORDER BY id ASC
      LIMIT $1`,
    [limit],
  );
  const events = rows.map(toChatEvent);
  const lastId = rows.reduce((max, row) => Math.max(max, row.id), 0);
  return { events, lastId };
};

export const markPublished = async (
  db: Queryable,
  ids: readonly number[],
): Promise<void> => {
  if (ids.length > 0) {
    await execute(
      db,
      "UPDATE outbox_events SET published_at = now() WHERE id = ANY($1::bigint[])",
      [ids],
    );
  }
};

const cursorRowSchema = z.object({ cursor: z.coerce.number() });

/** The highest outbox id for a chat — the snapshot's resume cursor. */
export const currentCursor = async (
  db: Queryable,
  chatId: string,
): Promise<number> => {
  const row = await queryOne(
    db,
    cursorRowSchema,
    "SELECT COALESCE(MAX(id), 0) AS cursor FROM outbox_events WHERE chat_id = $1",
    [chatId],
  );
  return row.cursor;
};
