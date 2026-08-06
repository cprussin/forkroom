import { z } from "zod";
import { getPool } from "../../../../../server/db/pool";
import { canReadChat } from "../../../../../server/domain/authorization";
import { problem } from "../../../../../server/http/responses";
import { getSessionUserId } from "../../../../../server/http/session-user";
import { streamChatEvents } from "../../../../../server/realtime/chat-event-stream";
import { getMemberRole } from "../../../../../server/repositories/members";
import { DomainErrors } from "../../../../../server/services/domain-error";

// Long-lived SSE needs the Node runtime (the `pg` driver) and must not be
// statically cached. `maxDuration` bounds the connection; the browser's
// EventSource reconnects and resumes from its last event id.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_MS = 15_000;
const cursorSchema = z.coerce.number().int().nonnegative().catch(0);

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    return problem(DomainErrors.unauthenticated());
  }
  const { chatId } = await params;
  const role = await getMemberRole(getPool(), chatId, userId);
  if (role === undefined || !canReadChat(role)) {
    return problem(DomainErrors.notMember());
  }

  const fromCursor = cursorSchema.parse(
    new URL(request.url).searchParams.get("cursor"),
  );
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode(": connected\n\n"));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, HEARTBEAT_MS);

      const pump = async () => {
        for await (const event of streamChatEvents({
          chatId,
          fromCursor,
          signal,
        })) {
          controller.enqueue(
            encoder.encode(
              `id: ${event.id.toString()}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );
        }
      };

      pump()
        .catch((error: unknown) => {
          controller.error(error);
        })
        .finally(() => {
          clearInterval(heartbeat);
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
};
