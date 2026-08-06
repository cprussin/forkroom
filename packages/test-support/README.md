# @forkroom/test-support

Shared Bun test setup for the packages that render React into a DOM. Every such
package needs the same three things before its tests run; this package owns them
in one place so they don't drift across the monorepo.

- `@forkroom/test-support/preload` — the one setup module: registers happy-dom's
  globals (giving the test a `document`/`window` to render into) *before*
  extending Bun's `expect` with jest-dom matchers (`toBeInTheDocument`, …) and
  cleaning the DOM up after each test. The two always go together, so they ship
  as a single preload.
- `matchers.d.ts` (the package's root `types` entry) — the ambient module
  augmentation that teaches `bun:test`'s `expect` about those matchers, so the
  type checker knows about them too.
- `@forkroom/test-support/expect-caught-error-logged` — an
  `expectCaughtErrorLogged(renderThrowing)` helper for error-boundary tests.
  It captures React's `console.error` for a caught error during the render,
  asserts it fired, and restores the real `console.error`, so an intentional,
  tested error path doesn't leak a stack trace into the suite output.

## Usage

Preload the setup module from the consuming package's `bunfig.toml`:

```toml
[test]
preload = ["@forkroom/test-support/preload"]
```

and pull the matcher types into that package's `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["bun", "@forkroom/test-support"] } }
```

## Test

`bun run --filter @forkroom/test-support test:types`. There are no unit tests — the
package is exercised transitively by every consumer's test suite.
