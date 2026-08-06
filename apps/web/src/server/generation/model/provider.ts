/**
 * The narrow model-provider seam. Domain and generation code depend only on
 * this interface; provider-specific request/response types stay inside the
 * adapters (`anthropic.ts`, `mock.ts`). Only one provider is wired at a time,
 * selected by configuration.
 */
export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelStreamChunk = { textDelta: string };

export type ChatModel = {
  readonly provider: string;
  readonly model: string;
  stream(input: {
    messages: readonly ModelMessage[];
    signal: AbortSignal;
  }): AsyncIterable<ModelStreamChunk>;
};
