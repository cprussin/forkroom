"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatEventSchema } from "../contracts/chat-events";
import type { ChatSnapshot } from "../contracts/chat-snapshot";
import { fetchSnapshot } from "./api-client";
import type { ChatState } from "./chat-reducer";
import { applyEvent, detectGap } from "./chat-reducer";
import { hydrateFromSnapshot } from "./hydrate";

const RECONNECT_DELAY_MS = 1500;

export type ChatStream = {
  state: ChatState;
  connected: boolean;
};

/**
 * Subscribe a client to a chat's realtime events. Hydrates from the initial
 * snapshot, then applies SSE events idempotently. On disconnect it reconnects
 * from the last event id; on a detected gap (a skipped event id) it refetches a
 * fresh snapshot and resumes — the load-then-subscribe-from-cursor discipline
 * the PRD requires (§7.5).
 */
export const useChatStream = (initialSnapshot: ChatSnapshot): ChatStream => {
  const [state, setState] = useState<ChatState>(() =>
    hydrateFromSnapshot(initialSnapshot),
  );
  const [connected, setConnected] = useState(true);
  const cursorRef = useRef(initialSnapshot.cursor);
  const chatId = initialSnapshot.chat.id;

  const resync = useCallback(async () => {
    const fresh = await fetchSnapshot(chatId);
    cursorRef.current = fresh.cursor;
    setState(hydrateFromSnapshot(fresh));
  }, [chatId]);

  useEffect(() => {
    let stopped = false;
    let source: EventSource | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const onEvent = (raw: MessageEvent<string>) => {
      const data = safeJsonParse(raw.data);
      const parsed = chatEventSchema.safeParse(data);
      if (parsed.success) {
        const event = parsed.data;
        if (detectGap(cursorRef.current, event.id)) {
          resync().catch(reportError);
        } else {
          setState((prev) => {
            const next = applyEvent(prev, event);
            cursorRef.current = next.lastEventId;
            return next;
          });
        }
      }
    };

    const connect = () => {
      source = new EventSource(
        `/api/chats/${chatId}/events?cursor=${cursorRef.current.toString()}`,
      );
      source.addEventListener("open", () => {
        setConnected(true);
      });
      source.addEventListener("message", onEvent);
      source.addEventListener("error", () => {
        setConnected(false);
        source?.close();
        if (!stopped) {
          reconnectTimer = setTimeout(() => {
            resync().catch(reportError).finally(connect);
          }, RECONNECT_DELAY_MS);
        }
      });
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [chatId, resync]);

  return { connected, state };
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const reportError = (error: unknown): void => {
  // biome-ignore lint/suspicious/noConsole: surface background resync failure
  console.error("chat stream resync failed", error);
};
