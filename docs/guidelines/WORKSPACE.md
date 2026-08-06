# Workspace

Tools, layout, dependencies, and the required-checks workflow for the
TypeScript monorepo.

## Tools

We use the following tooling for our TypeScript monorepo:

- `bun` is our package manager & runtime when needed
- `turbo` is our monorepo task orchestrator
- `biome` is our linter / syntax checker

## Layout

The TypeScript code in this repo is divided into bun workspaces. In general,
the workspaces go in one of the following top-level directories:

- `/apps` — bun workspaces that define user-facing apps (`argo-desktop`,
  `agent-host`)
- `/packages` — TypeScript libraries
  - `/packages/component-library` — React component library that should be
    used for building all apps

See the [root README](/README.md) for the full package map and the
dependency graph between packages.

## Package READMEs

Every package or service in `/apps/` and `/packages/` should have a
`README.md`. It should orient a new contributor: what the package does,
why it exists, its dependencies, how to use it, and how to test it. Be
comprehensive but succinct — enough to get someone productive without
re-reading the source.

Keep the README current as the package evolves. If a change affects the
public API, dependencies, usage, or what the package delivers, update
the README in the same change.

## Dependencies

### `catalog:` for all non-workspace deps

Every non-workspace dependency in any `package.json` MUST use `"catalog:"` as
its version, and every workspace dependency MUST use `"workspace:*"`. The
concrete version belongs in the root `package.json`'s `catalog` block, which
is the single source of truth for third-party versions across the monorepo.

```jsonc
// in a package
"dependencies": {
  "zod": "catalog:",
  "@argo/tools": "workspace:*"
}
```

To add a new third-party dependency:

1. Add the package and version to the root `package.json` `catalog` block,
   alphabetically sorted.
2. Reference it as `"catalog:"` in the consuming package's `package.json`.
3. Run `bun install` to refresh `bun.lock`.

Writing a concrete version (e.g. `"zod": "4.4.3"`) directly in a package is
wrong — any non-`workspace:` value other than `"catalog:"` is a defect. If
you find a direct version spec already in the repo, fix it.

### Latest versions

Use the latest stable version of any new dependency unless there is a
specific compatibility reason to pin older.

### Approval

Do not introduce a new third-party runtime dependency without confirming with
the developer that this is the intent.

## Required code checks

All code should pass all checks run via `bun run turbo test -- --ui stream`.
This will ensure code passes linting, typechecking, and format checks. If
code is failing, first try running `bun run turbo fix -- --ui stream` to
apply auto-fixes.

**Important:** the `bun run turbo` alias may resolve to a package-scoped
turbo invocation that only runs a subset of tasks. To run the full test
suite across all packages **and** root-level tasks (lint, dependency
checks), use `node_modules/.bin/turbo test` directly, or verify that the
output shows all tasks (including `//#test:lint` and `//#test:dependencies`).
The root-level `biome check` (run by `//#test:lint`) enforces formatting,
import ordering, and lint rules across the entire monorepo — always verify
it passes before considering tests complete.
