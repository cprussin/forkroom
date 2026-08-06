import type { ContextMessage } from "../domain/context";
import type { ModelMessage } from "./model/provider";

/**
 * Convert an ordered branch context into provider messages: prepend the system
 * prompt, then include only completed messages (queued/streaming placeholders
 * and failed turns are not sent to the model).
 */
export const toModelMessages = (
  context: readonly ContextMessage[],
  systemPrompt: string,
): ModelMessage[] => [
  { content: systemPrompt, role: "system" },
  ...context
    .filter((message) => message.status === "completed")
    .map((message) => ({ content: message.content, role: message.role })),
];
