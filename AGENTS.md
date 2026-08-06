# AGENTS

Index of context files for this TypeScript monorepo (`apps/*`,
`packages/*`). Each entry is tagged with an authority level so its weight is
unambiguous.

The guideline docs in [`/docs/guidelines/`](/docs/guidelines/) are ported
directly from the `argo-browser` project, whose engineering standards this
codebase follows. Their principles are general; where an example names an
`argo`/`@argo` package, read it as an illustration of the pattern, not a
literal dependency of this repo. The one binding, repo-specific mapping is the
styling preset: this repo's is `@forkroom/component-library`.

## Authority levels

- **ALWAYS** — load and read in full before any work. No exceptions for size,
  urgency, familiarity, or "trivial" edits. Skipping an ALWAYS doc is a
  protocol violation, not a judgment call.
- **IF TOUCHED** — required when your change touches the topic. The decision
  is "does my change touch the topic," not "do I feel like reading this." If
  touched, load in full.
- **REFERENCE** — look up as needed during the work; not a prerequisite to
  start.

If a doc's own wording disagrees with these labels, the labels here win —
update the doc.

## Post-edit audit (non-negotiable)

After finishing edits — and before declaring a change done or opening a
PR — re-load the guideline docs that apply to what you just changed and walk
the actual diff against each rule. This is a protocol step, not a judgment
call. "Lint and tests passed" is not a substitute: many style rules are not
lint-enforced.

**This audit runs on EVERY code change, not just the first.** Redo the "which
docs apply" determination from scratch for each change; do not assume the
earlier audit still covers you.

## PR description requirement

Every PR description MUST include an explicit "Guidelines audited" line
listing the docs reviewed and confirming the change complies. Example:

> **Guidelines audited:** `docs/guidelines/CONTROL_FLOW.md`,
> `docs/guidelines/ERRORS.md`, `docs/guidelines/TESTING.md`. Change complies
> with all rules.

If a rule deserves a note (intentional deviation, ambiguous case, etc.), call
it out below the line. A PR without this line is incomplete.

## ALWAYS (every change, no exceptions)

These apply to every TS file you write or modify — bug fixes, one-line
changes, refactors, and "trivial" edits included.

| Doc | Covers |
|---|---|
| [/docs/guidelines/TESTING.md](/docs/guidelines/TESTING.md) | **TDD is mandatory.** Failing test first, then the minimum production code to make it pass. Parsimonious coverage, unit over integration, dependency injection over mocking, never widen exports for tests, warnings are failures. |
| [/docs/guidelines/ERRORS.md](/docs/guidelines/ERRORS.md) | **Code offensively** (PR-blocker): no defensive guards, no catch-and-swallow, no silent fallbacks; throw or return a `Result`. Promise error handling (never `void promise()`). |
| [/docs/guidelines/CONTROL_FLOW.md](/docs/guidelines/CONTROL_FLOW.md) | `undefined` over `null`, explicit `undefined` checks, curly braces always, explicit control flow, ternaries, no unnecessary `let`, `switch` over `if`/`else if`. |
| [/docs/guidelines/FUNCTIONS.md](/docs/guidelines/FUNCTIONS.md) | Functional/immutable/declarative defaults, arrow syntax, docstrings, manual loops over generators. |
| [/docs/guidelines/FILES.md](/docs/guidelines/FILES.md) | File/directory organization: top-to-bottom reading order, import from defining modules, no grab-bag names, prefer module-scoped functions. |

## IF TOUCHED (load when your change touches the topic)

| Doc | Load when |
|---|---|
| [/docs/guidelines/REACT.md](/docs/guidelines/REACT.md) | You author or modify a component, hook, or JSX. No `className`/`style` prop, Phosphor icon imports, wrapping `@base-ui/react`, the error-boundary contract, and never suppress `useExhaustiveDependencies`. |
| [/docs/guidelines/STYLING.md](/docs/guidelines/STYLING.md) | Any Panda CSS / UI styling work. **Mandatory for any UI package.** Panda CSS is the only styling system; all packages extend the `@forkroom/component-library` preset and use its components where possible. |
| [/docs/guidelines/ICONS.md](/docs/guidelines/ICONS.md) | You import a Phosphor icon. SSR path, `*Icon`-suffixed name, no barrel. |
| [/docs/guidelines/DATA.md](/docs/guidelines/DATA.md) | You read external data — API responses, realtime messages, `JSON.parse`, URL params, env vars, SQL rows. Never `as`-cast; parse with Zod at the boundary. Versioning rules for contracts that cross deploy units. |
| [/docs/guidelines/DISCRIMINATED_UNIONS.md](/docs/guidelines/DISCRIMINATED_UNIONS.md) | You define or modify a discriminated union. Enum discriminant + PascalCase constructor object + type derived via `ReturnType`; wire formats keep string literals and are authored as the Zod schema. |
| [/docs/guidelines/OPTION_RESULT.md](/docs/guidelines/OPTION_RESULT.md) | You design or modify a fallible API, a parser, or a domain operation. When to return `Result<T, E>` / `Option<T>` from `@cprussin/option-result` instead of throwing or returning `undefined`. |
| [/docs/guidelines/DESIGN_DOCS.md](/docs/guidelines/DESIGN_DOCS.md) | You author or modify a design doc in /docs/architecture/. Be concise and direct: lead with the answer, show don't describe, decisions not musings. |

## REFERENCE

| Doc | Covers |
|---|---|
| [/docs/guidelines/WORKSPACE.md](/docs/guidelines/WORKSPACE.md) | Tools (bun, turbo, biome), workspace layout, package READMEs, dependency policy (`catalog:` / `workspace:*`), and the required-checks workflow you run before a PR. |
| [/docs/guidelines/TOOLS.md](/docs/guidelines/TOOLS.md) | Ported from argo; describes the agent-tool authoring pattern. Not used by this repo today — kept for provenance and in case tool-style extensions are added later. |

## Architecture docs

[`/docs/architecture.md`](/docs/architecture.md) documents this system:
module boundaries, the prompt transaction, realtime delivery, the generation
lifecycle, and deployment topology. Architecture decision records live in
[`/docs/decisions/`](/docs/decisions/). These describe how the system is
built; they carry no authority level.

## Per-package addenda

When working on any package in `/apps/` or `/packages/`, check for and load
package-specific agent instructions in `{package}/docs/AGENTS.md` if such a
file exists. These hold rules specific to the package and augment — never
weaken — the root docs. On conflict, package rules win.

**Example**: when working on `packages/component-library`, load
`packages/component-library/docs/AGENTS.md`.

DO NOT proceed with any changes until the relevant files are loaded and
understood.
