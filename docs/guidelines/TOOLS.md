# Tools

Rules for authoring agent tools in this monorepo. The shared types and
helpers live in `@argo/tools` (`packages/tools/`). Each tool is its own
workspace package.

## Adding a new tool

Create a new bun workspace at `packages/tool-<name>/` — one package per
tool. Do not add tool implementations inside `packages/tools/`; that
package is the shared interface only.

Each tool package should include:

- A `Tool` definition built with `defineTool` (see below)
- Unit tests for the tool's behavior
- A `README.md` per [/docs/guidelines/WORKSPACE.md](/docs/guidelines/WORKSPACE.md)

Typical layout:

```
packages/tool-<name>/
  src/index.ts       # tool definition (worker-safe main export)
  src/ui.tsx         # optional approval UI (separate export)
  src/*.test.ts
  README.md
```

## Tool interface

Implement the `Tool` type from `@argo/tools/tool`. Always use
`defineTool` — it keeps the `call` handler typed at definition time
while the returned `Tool` stays compatible with heterogeneous `Tool[]`
collections.

```ts
import { defineTool } from "@argo/tools/tool";
import { Type } from "@sinclair/typebox";

export const echo = defineTool({
  name: "echo",
  description: "Echo the input text back.",
  argSchema: Type.Object({ text: Type.String() }),
  permission: "open",
  call: async (args, ctx) => args.text,
});
```

Required fields:

- `name` — stable identifier the model sees
- `description` — what the tool does; written for the model
- `argSchema` — TypeBox schema for args. The schema *is* the JSON
  Schema the model sees, threaded through verbatim. See
  [/docs/guidelines/DATA.md](/docs/guidelines/DATA.md) for the broader rule.
- `permission` — `"open"` or `"approval-required"`
- `call` — `(args, ctx) => Promise<Result>`; `args` is typed via
  `Static<typeof argSchema>`, and `ctx` is a `ToolCallContext` with
  `signal: AbortSignal`

Optional: `defaultTimeoutMs` when the tool needs a non-default timeout;
`deferLoading: true` to hint that the tool may be hidden behind provider
tool search when the host and model support it (adapters that can't
honor the hint send the tool inline as usual).

Respect `ctx.signal` in long-running work. `call` may throw; executors
wrap failures into structured errors.

## Tests and README

Add unit tests alongside the tool. Follow [/docs/guidelines/TESTING.md](/docs/guidelines/TESTING.md)
— parsimonious coverage, prefer unit tests, dependency injection over
mocking.

The package `README.md` should explain what the tool does, its args,
permission level, where it runs (host or remote), and how to test it.
Update the README when the tool's API or behavior changes.

## Host-local vs remote

Tools can run in the host process or on a remote worker process
(running a `ToolWorker` from `@argo/tool-executor-remote`). Pick based
on where the tool's side effects and secrets must live.

### Host-local

Use when the tool should run in the host app — e.g. it needs direct
access to host UI, local filesystem, or host-managed credentials.

- Export the `Tool` from the package main entry
- Register it with `localToolExecutor` in the host's tool registry
- Optional: ship a `tool-<name>/ui` export for custom approval UI and
  register it in the host's display registry

### Remote

Use when the tool should run in a separate worker process — e.g. it
needs access to the user's machine, long-lived local state, or
resources that shouldn't live in the host.

- Keep the main export worker-safe: no React, no host-only imports
- Put approval UI in a separate `tool-<name>/ui` export (consumed by
  the host only)
- Worker bundles may depend on `@argo/tools`, `@argo/tool-executor`,
  `@argo/protocol-tools`, and `@argo/transport-ws` — never `@argo/agent-loop`
- The worker process runs `createToolWorker` from
  `@argo/tool-executor-remote/tool-worker`; a thin binding carries its parsed
  frames over a `@argo/transport-ws` `WireConnection` to the host's `WorkerHub`
- The host routes calls through `remoteToolExecutor`

The `Tool` itself has no notion of locality — the same definition runs
in either deployment, provided `args` and the return value are
JSON-serializable. The "where it lives" axis is purely a
registration-time concern.

If a tool only works in one environment, say so in the README.
