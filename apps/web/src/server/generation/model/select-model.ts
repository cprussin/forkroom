import { getServerEnv } from "../../env";
import { createAnthropicModel } from "./anthropic";
import { createMockModel } from "./mock";
import type { ChatModel } from "./provider";

/**
 * Build the configured model. `MODEL_PROVIDER=mock` (the default) needs no
 * credentials; `anthropic` requires `ANTHROPIC_API_KEY`. Fails loudly when the
 * key is missing rather than silently degrading.
 */
export const selectModel = (): ChatModel => {
  const env = getServerEnv();
  switch (env.MODEL_PROVIDER) {
    case "mock": {
      return createMockModel(env.MODEL_NAME);
    }
    case "anthropic": {
      if (env.ANTHROPIC_API_KEY === undefined) {
        throw new Error("MODEL_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
      } else {
        return createAnthropicModel(env.ANTHROPIC_API_KEY, env.MODEL_NAME);
      }
    }
  }
};
