import type { ChatModel, ModelMessage, ModelStreamChunk } from "./provider";

/**
 * A deterministic, dependency-free model used in development and tests. It
 * streams a short reply word-by-word so the full streaming/checkpoint path is
 * exercised without an API key or network. Honors the abort signal between
 * chunks.
 */
export const createMockModel = (model = "mock-1"): ChatModel => ({
  model,
  provider: "mock",
  async *stream({ messages, signal }): AsyncIterable<ModelStreamChunk> {
    const reply = composeReply(messages);
    const words = reply.split(" ");
    for (let index = 0; index < words.length; index++) {
      if (signal.aborted) {
        throw new Error("aborted");
      }
      const word = words[index];
      yield { textDelta: index === 0 ? (word ?? "") : ` ${word ?? ""}` };
      await delay(15);
    }
  },
});

const composeReply = (messages: readonly ModelMessage[]): string => {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = lastUser?.content ?? "";
  const preview = prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;
  return `This is a mock assistant reply to: "${preview}". Replace the mock provider with a real one by setting MODEL_PROVIDER=anthropic.`;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
