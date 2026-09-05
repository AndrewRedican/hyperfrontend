---
name: de-jest
description: Migrate a JS/TS codebase off Jest onto Node's built-in node:test with no replacement framework: shim expect/jest.fn/fake timers, keep jest.mock working under native ESM via loader hooks, gate V8 coverage honestly, preload jsdom, tear Jest down. Use when removing Jest, adopting node:test, replacing ts-jest or @nx/jest, or debugging a node:test port (tests missing from the report, coverage drift, jest.mock under ESM, fake timers, jsdom globals, type-strip syntax errors).
---

# De-Jest: Jest to `node:test`

Node >= 22.18 (sync `module.registerHooks`, type stripping on by default).

## Gate

- **The test count is an assertion.** Green without `# tests N` is no evidence: cached task replays, inline `RuleTester`, stdout stubs all pass silently.
- **Never `--test-force-exit`.** It drops tests from the report nondeterministically. Fix the leak.
- **Coverage vetoes architecture.** A CJS-transpiling loader reports 100/100 on 83/50: unremappable positions count as covered. Emit ESM.
- **Never test the shim with itself.** Its suite runs on bare `node:test` + `node:assert`.
- Census before strategy: files with `jest.mock(` are the cost driver, not test count or DOM use. Snapshots and `expect.extend` must read 0 for a shim.
- Baseline per project from `npx jest --showConfig` (what Jest computes, not what the config says). Done = identical count, coverage >= baseline, completeness check green.
- Pragmas: delete every `istanbul ignore`, run, add `/* node:coverage ignore next N */` only where the V8 report demands.
- Thresholds judged on your own lcov merge, never `--test-coverage-lines`: Node counts a re-evaluated module N times.

## Runner

| Symptom                                         | Cause                                                                           | Fix                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `it.todo` body executes                         | `node:test` runs todo bodies                                                    | `todo: (title) => nodeIt(title, { todo: true }, () => undefined)`                                                                                      |
| Spawned child runner prints nothing, exit 0     | inherits `NODE_TEST_CONTEXT`; "skipping running files" goes to stderr only      | `delete env['NODE_TEST_CONTEXT']` before spawn                                                                                                         |
| Report counts fewer tests than declared, exit 0 | a test stubbed `process.stdout.write` across an `await`; a report line vanished | restore synchronously; never hold the stub across an `await`                                                                                           |
| `beforeEach(fn, 10000)` timeout ignored         | numeric options argument silently accepted                                      | `beforeEach(fn, { timeout: 10000 })`; shim `it(title, fn, ms)` into `{ timeout: ms }`                                                                  |
| `(done)` never called                           | Node body signature is `(t, done)`                                              | adapt by arity: `body.length === 1 ? (_t, done) => body(done) : body`                                                                                  |
| ESLint `RuleTester` cases pass, most unreported | no framework registered, so cases run inline                                    | assign `RuleTester.describe/it/itOnly` (and `afterAll`, `describeSkip`, `itSkip` on `@typescript-eslint/rule-tester`) from the shim in a setup preload |
| `expect.assertions(n)` never fails              | the counter is checked by the shim's `it`, not Node's                           | import `it` from the shim everywhere, never selectively                                                                                                |
| `--test` runs files the environment excluded    | no exclude syntax; an empty explicit list makes Node self-discover              | `fs.globSync(match, { exclude })`; throw on empty                                                                                                      |

## TypeScript under strip mode

| Symptom                                                 | Cause                                                                       | Fix                                                                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`: angle-bracket      | `<T>expr` rejected                                                          | codemod to `expr as T`; delete or invert any lint rule mandating angle brackets                                                                                                                            |
| `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`: parameter property | `constructor(public x)` rejected                                            | explicit field + assignment (`--experimental-transform-types` also unlocks `enum`/`namespace`, still not decorators)                                                                                       |
| `SyntaxError` on `@decorator`                           | neither TS mode parses decorators                                           | apply in the spec as the compiler emits: `defineProperty(C.prototype, 'm', locked()(C.prototype, 'm', getOwnPropertyDescriptor(C.prototype, 'm')))`                                                        |
| Strict-mode-only throw stops asserting                  | stripping emits no `'use strict'`; a CJS `.ts` spec runs sloppy             | `'use strict'` as the first statement of CJS specs asserting it                                                                                                                                            |
| JSON import throws                                      | native ESM requires `with { type: 'json' }`                                 | inject `importAttributes: { type: 'json' }` in the load hook for `.json` URLs                                                                                                                              |
| ESM suite was green under ts-jest, fails natively       | ts-jest compiled `await import()` to CJS interop; the ESM surface never ran | treat every ESM surface behind a transpiling runner as unverified; sweep every `exports` entry with native `import()`, target via env var, argv empty (`argv[1]` main-detection self-executes CLI entries) |

## `jest.mock` under ESM

Loophole: Node runs a module's `load` hook before resolving its imports. Read `jest.mock(` out of the spec source there; every target is registered before the spec's imports link.

| Symptom                                        | Cause                                                                            | Fix                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Built-in (`node:fs`) never mocked              | the loader already imported it; it never reaches `load` again                    | substitute at **resolve** time under a private URL scheme                                                                                          |
| Second mock stays real                         | registration loaded the first mock; a barrel bound the real second module        | never load during registration; automock of a built-in is the sole exception                                                                       |
| Duplicate coverage records for the mocked file | replacement reached the real module via a query-string variant                   | replacement imports the real URL verbatim; serve it as `format: 'module-typescript'`                                                               |
| `requireActual` returns the mock               | `require.resolve` also runs through the hooks                                    | strip the mock scheme back to the target URL                                                                                                       |
| Stack overflow inside a factory                | export named `setInterval` forwarding to "the global" resolves to itself         | bind to a prefixed local, `export { __export$setInterval as setInterval }`                                                                         |
| Factory export silently real                   | scanner missed shorthand properties `{ foo }`                                    | a key is an identifier followed by `:`, `,` or `}`; nested literal keys are not exports                                                            |
| Mocks registered for modules that do not exist | `jest.mock(` inside strings, comments, templates                                 | blank literals and comments before scanning                                                                                                        |
| Alias mock never applied                       | registry resolved the specifier differently from the loader                      | registry and loader share one resolver                                                                                                             |
| `jest.spyOn(namespace, 'fn')` throws           | ESM namespace is sealed; importers bind at link time                             | `jest.mock` with a factory wrapping the function                                                                                                   |
| Importing an un-named export is a link error   | factory names some exports; Jest left the rest undefined                         | `export *` passthrough from the real module (documented divergence: turns a crash into working code)                                               |
| `resetModules` has nothing to evict            | ESM has no eviction API                                                          | generation counter in a URL query; keep it on `globalThis[Symbol.for(...)]` or the hook module and `jest` API import each other and register twice |
| Setup-file mocks ignored                       | a setup module is not recognisable as a spec                                     | pass its path via env; register its declarations at load                                                                                           |
| Verified "real function returned", still wrong | the probe measured a different `jest` object (factory-scoped) than the spec body | verify at the exact call site that misbehaves                                                                                                      |

## Fake timers

| Symptom                                       | Cause                                        | Fix                                                                                                          |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `runAllTimers` leaves cascaded timers pending | Node's `runAll` drains the queue as it stood | track outstanding timeout handles (not intervals); loop `runAll` until none, cap 1000 passes                 |
| `runAll` throws `Received 'positive integer'` | delay below 1 kept verbatim (`-500`, `0`)    | clamp at scheduling `Math.max(delay ?? 1, 1)`; clamping to 0 makes a zero-period interval allocate until OOM |
| `clearAllTimers` missing                      | no primitive                                 | `mock.timers.reset()` then re-enable at `Date.now()`                                                         |
| Fake clock drives nothing under jsdom         | jsdom's timers shadow Node's                 | never copy jsdom `setTimeout`/`clearTimeout`/`setInterval`/`clearInterval`/`queueMicrotask`/`performance`    |

## Coverage

| Symptom                                   | Cause                                                                                      | Fix                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Untested file passes a 100% gate          | Node omits files no test loaded, no 0% row                                                 | completeness check: `globSync(include, { exclude })` minus lcov `SF:` set, fail on any; exclude declaration-only modules explicitly                      |
| 99% project reads 96%                     | `resetModules`: one file, N records; Node counts every line N times, credits one           | merge records per `SF:`: sum `DA`; pair `FN`/`FNDA` positionally                                                                                         |
| Identical per-file table, drifting totals | lcov numbers anonymous functions by discovery order; block numbers shift                   | key functions by `line,name` with `anonymous_\d+` folded; branches by `line,index`, never block                                                          |
| Ignored region still an untaken branch    | pragma drops `DA` lines but keeps `FN`/`BRDA` on them                                      | drop `FN`/`BRDA` whose line is absent from the record's `DA` set                                                                                         |
| Pragma does nothing                       | trailing text after `ignore next N`; `disable`/`enable` in `//` form; placed mid-statement | `/* node:coverage ignore next 2 */` alone on its line, above the whole statement, N spanning the closing brace; `/* node:coverage disable */` block form |
| Branch % lower than istanbul              | V8 counts default params and `?.`; istanbul counted the implicit `else`                    | interrogate the deficit before lowering a threshold; most of it is measurement                                                                           |
| Coverage service matches nothing          | lcov `SF:` relative to the project                                                         | rebase paths to the repo root when writing the merged `lcov.info`                                                                                        |

## DOM preload

One process per environment, routed by filename glob (`*.browser.spec.ts`); `@jest-environment` docblocks become dead comments.

| Rule                                                                                    | Why                                                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Skip intrinsics; derive the set from a bare `vm` context, never a list                  | a copied `Array`/`Promise` makes `instanceof` disagree process-wide                                 |
| Keep Node's `crypto`, `URL`, `URLSearchParams`, timers, `performance`, `queueMicrotask` | webcrypto `subtle`; `node:url` identity; the fake clock                                             |
| Keep Node's `atob`/`btoa`                                                               | jsdom's delegate to the global of the same name: self-recursion reported as `InvalidCharacterError` |
| Copy values, not descriptors                                                            | `document`/`navigator`/`location` getters throw off-window                                          |
| Bind `addEventListener`/`removeEventListener`/`dispatchEvent` explicitly                | inherited, not own; the global must listen and dispatch on one target                               |
| `window`/`self`/`globalThis`/`parent`/`top` all = `globalThis`                          | a spy on `window.x` must be visible to code calling bare `x`                                        |

## Codemods

- `--no-config-lookup` with a standalone ESLint config, or every workspace config loads and a targeted fix becomes an unrelated-rule rewrite.
- A standalone config strips `eslint-disable` directives for rules it does not define. After every codemod commit, `git diff <base> HEAD | grep -E '^-.*eslint-disable'` must be empty.
- Pass directories, not globs; globs silently skip files.
- `*.template` files escape lint and codemods: run the generator, then lint and test its output.

## Checklist

- [ ] Every project: identical count, coverage >= baseline, completeness green; no `--test-force-exit`
- [ ] Shim suite runs on bare `node:test` + `node:assert`
- [ ] Pragmas re-derived from V8 reports, not translated
- [ ] Loss ledger written: HTML reporter, `statements` metric (fold into `lines`), `eslint-plugin-jest`, hook timeout argument, `@jest-environment`, namespace `spyOn`
- [ ] `ts-node` removed when only `jest.config.ts` needed it; orphaned `overrides` re-checked with `npm ls`
- [ ] Lock regenerated, package count before/after recorded; residual `jest` strings are third-party optional `peerDependencies` metadata, not installs
