# 0005 — Narrow model-provider seam

**Decision:** Hide the AI provider behind a small `ChatModel` interface
(`generation/model/provider.ts`). Implement Anthropic for production and a
dependency-free mock for dev/tests. Select by `MODEL_PROVIDER`.

**Why:** The PRD wants one replaceable streaming provider with provider-specific
types kept out of domain and UI code (§8, §20). The interface is just:

```ts
type ChatModel = {
  readonly provider: string;
  readonly model: string;
  stream(input: { messages: readonly ModelMessage[]; signal: AbortSignal }):
    AsyncIterable<{ textDelta: string }>;
};
```

`run-generation.ts` depends only on this. The Anthropic adapter maps unified
messages to the provider's request (hoisting system messages) and parses stream
events with Zod — no `as`-casts, robust across SDK versions. The mock streams a
deterministic reply word-by-word, so the full streaming/checkpoint path runs
locally and in tests with no API key or network.

**Consequences:** Adding a provider is a new adapter file and a `MODEL_PROVIDER`
value; nothing else changes. Credentials load only on the server.
