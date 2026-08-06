import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ChatModel, ModelStreamChunk } from "./provider";

const MAX_TOKENS = 2048;

// The one stream-event shape this adapter cares about. `safeParse` narrows the
// SDK's event union without an `as`-cast and stays robust across SDK versions
// (whose own versioning is the contract — see docs/guidelines/DATA.md).
const textDeltaEventSchema = z.object({
  delta: z.object({ text: z.string(), type: z.literal("text_delta") }),
  type: z.literal("content_block_delta"),
});

/**
 * Anthropic streaming adapter. Provider-specific types live here and nowhere
 * else. System messages are hoisted to the top-level `system` field (the API
 * does not take a `system` role in the messages array); text deltas are yielded
 * as they arrive.
 */
export const createAnthropicModel = (
  apiKey: string,
  model: string,
): ChatModel => {
  const client = new Anthropic({ apiKey });
  return {
    model,
    provider: "anthropic",
    async *stream({ messages, signal }): AsyncIterable<ModelStreamChunk> {
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
      const turns = messages
        .filter((message) => message.role !== "system")
        .map((message): { content: string; role: "user" | "assistant" } => ({
          content: message.content,
          role: message.role === "assistant" ? "assistant" : "user",
        }));

      const stream = client.messages.stream(
        { max_tokens: MAX_TOKENS, messages: turns, model, system },
        { signal },
      );
      for await (const event of stream) {
        const parsed = textDeltaEventSchema.safeParse(event);
        if (parsed.success) {
          yield { textDelta: parsed.data.delta.text };
        }
      }
    },
  };
};
