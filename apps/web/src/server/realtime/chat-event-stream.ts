import type { ChatEvent } from "../../contracts/chat-events";
import type { Queryable } from "../db/pool";
import { getPool } from "../db/pool";
import { fetchEventsAfter } from "../repositories/outbox";

const DEFAULT_POLL_MS = 300;
const BATCH_LIMIT = 200;

export type ChatEventStreamOptions = {
  chatId: string;
  fromCursor: number;
  signal: AbortSignal;
  pollIntervalMs?: number;
  pool?: Queryable;
};

/**
 * Stream a chat's events from `fromCursor` onward by polling the transactional
 * outbox. The outbox is the source of truth, so delivery survives the realtime
 * layer being briefly unavailable: a reconnecting client resumes from its last
 * event id and re-reads any events it missed. Yielding stops when the signal
 * aborts (client disconnect or server max-duration).
 *
 * Polling the durable outbox (rather than an in-process pub/sub) is what makes
 * this correct across serverless instances — see
 * `docs/decisions/0003-realtime-sse-outbox-polling.md`.
 */
export async function* streamChatEvents(
  options: ChatEventStreamOptions,
): AsyncIterable<ChatEvent> {
  const pool = options.pool ?? getPool();
  const pollMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  let cursor = options.fromCursor;

  while (!options.signal.aborted) {
    const events = await fetchEventsAfter(
      pool,
      options.chatId,
      cursor,
      BATCH_LIMIT,
    );
    for (const event of events) {
      yield event;
      cursor = Math.max(cursor, event.id);
    }
    if (events.length < BATCH_LIMIT) {
      await waitOrAbort(pollMs, options.signal);
    }
  }
}

const waitOrAbort = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
