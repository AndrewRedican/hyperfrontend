# Commit Authoring Consolidation Plan

Absorb `commitizen`, `cz-conventional-changelog` (+ patch), `@commitlint/cli`, `@commitlint/config-conventional`, and `patch-package` into `@hyperfrontend/versioning` as two capabilities: an interactive conventional-commit authoring session (`cz` bin) and a conventional-commit message validator (`cl` bin). `lib-versioning` remains general-purpose and fully configurable; monorepo dogfood behavior is supplied by a workspace-root `commit.config.js`, not baked into the library.

**Date**: 2026-04-21
**Status**: Approved (grill session complete)

---

## Locked Design Decisions

Reference record; each is resolved and non-negotiable for this plan.

| ID   | Decision                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | New module: `libs/versioning/src/commits/author/` (session runner, steps, presets)                                                                                                                                               |
| A4   | Authoring uses its own minimal `session` runner (not the existing `flow/` executor, which is release-centric)                                                                                                                    |
| B    | Validation is a pure submodule: `libs/versioning/src/commits/validate/`, used in three places (inline step validators, preview warnings, out-of-band `commit-msg` hook)                                                          |
| C1   | Hard dep on `@hyperfrontend/questions` inside the session; no `Prompter` interface indirection. Bundled at publish                                                                                                               |
| D1c  | Staged-file source is injectable; default implementation uses `git diff --cached --name-only -z`                                                                                                                                 |
| D2a  | Per-file owner resolution uses `findProjectRoot` walk-up from `@hyperfrontend/project-scope`                                                                                                                                     |
| D3   | Default selection: (1) single owner → that project; else (2) nearest common-ancestor `project.json` → that; else (3) no default, full list. A configurable majority-ratio tiebreaker is supported but not applied in MVP dogfood |
| D4a  | Workspace-root `project.json` (`@hyperfrontend/workspace`) is just another discovered project — no special sorting                                                                                                               |
| D5a  | Scope filter is consumer-provided (`scopeFilter?: (path, name) => boolean`). Library auto-excludes only `node_modules` and `.git`                                                                                                |
| D6b  | `ConventionalCommit.scope` changes from `string \| undefined` to `readonly string[]` — **breaking change** to lib-versioning public API                                                                                          |
| D7   | Scope list shown is **only** projects relevant to staged changes — union of `project.json` on walk-up from each staged file                                                                                                      |
| D8   | Step sequence: `resolve-scope` → `type` → `scope` → `subject` → `body` → `breaking` → `issues` → `preview` → `commit`                                                                                                            |
| D9   | Type enum default = 11 Conventional Commits types; fully configurable                                                                                                                                                            |
| D10  | Subject rules: no case restriction, no lowercase filter, strip trailing period, trim edges                                                                                                                                       |
| D11  | 72-char header countdown (live, green → yellow → red); configurable                                                                                                                                                              |
| D12  | Imperative-mood detection: first-word case-insensitive match against a small past-tense wordlist; warn-only, never blocks; configurable                                                                                          |
| D13a | Preview step: confirm / cancel-and-restart-with-prefilled-defaults                                                                                                                                                               |
| D14a | `lib-questions` extension: add `searchable?: boolean` option to `select()` (mirrors `multiselect()`'s existing option)                                                                                                           |
| D15c | Git commit execution is default-on, injectable via `{ skipCommit?: boolean, commitExecutor?: (msg) => Promise<void> }`; default uses `libs/versioning/src/git/operations/commit.ts`                                              |
| D16  | Bin names: `cz` (interactive) and `cl` (validator)                                                                                                                                                                               |
| D17a | Config file: `commit.config.{js,mjs,cjs}` auto-discovered at workspace root; `--config <path>` override; **not** in `package.json`                                                                                               |
| E1a  | Empty staging → refuse with error, exit non-zero                                                                                                                                                                                 |
| E2   | Ctrl-C at any step → exit 130 (SIGINT); in-memory draft discarded; git index untouched                                                                                                                                           |
| E3a  | `git commit` failure bubbles up; user restarts from scratch; no draft persistence                                                                                                                                                |

---

## Phase 1 — Foundation: `lib-questions` searchable select

Unblocks the scope and type prompts (both need searchable single-select). Extends `select()` to match the `searchable` option already present on `multiselect()`. Zero impact to existing consumers (option is opt-in).

### Files to modify

| Path                                        | Change                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/questions/src/types.ts`               | Extend `SelectConfig` with `searchable?: boolean` (default `false`). Mirror the shape already present on `MultiselectConfig`                                                           |
| `libs/questions/src/prompts/select.ts`      | Add filter-as-you-type state, backspace/printable-char key handlers, `filterChoices()` substring matcher (copy pattern from `multiselect.ts`), render hints for `(N more above/below)` |
| `libs/questions/src/prompts/select.spec.ts` | Existing non-searchable test coverage stays green                                                                                                                                      |

### Files to create

| Path                                                   | Purpose                                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/questions/src/prompts/select-searchable.spec.ts` | Test matrix: type to filter; backspace; filter narrows list; scroll works with filter active; empty-filter resets; selecting a filtered item returns correct value |

### Reference implementation to mirror

- `libs/questions/src/prompts/multiselect.ts` — already has `searchable` (line ~178), `filterChoices()` (line ~56), `scrollOffset` state, `(N more above/below)` rendering. Copy the mechanism, adapt for single-select selection state.

### Verification

```bash
npx nx test @hyperfrontend/questions
npx nx lint @hyperfrontend/questions --fix
npx nx typecheck @hyperfrontend/questions
npx nx format:write --projects=@hyperfrontend/questions
```

**Acceptance:** `select({ searchable: true, choices: [...] })` filters as user types and scrolls within the filtered result set. Non-searchable select behavior is identical to before.

---

## Phase 2 — Foundation: `ConventionalCommit.scope` breaking-change migration

Migrate the scope field from `string | undefined` to `readonly string[]`. Must land before Phase 5 (`commits/author/`) so the session can emit the new shape directly.

### Files to modify

| Path                                                              | Change                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/src/commits/models/conventional.ts`              | `scope?: string` → `scope: readonly string[]`. Update `createConventionalCommit()` to accept `readonly string[]` (single-scope callers pass `[scope]`). Update `buildRaw()` to join scopes with `,` when writing the header (`type(a,b): subject`) |
| `libs/versioning/src/commits/models/conventional.spec.ts`         | Update fixtures to `readonly string[]`                                                                                                                                                                                                             |
| `libs/versioning/src/commits/parse/header.ts`                     | Accept `type(a,b,c): subject`; split comma-separated scope into `readonly string[]`; single-scope headers produce a one-element array; scopeless headers produce `[]`                                                                              |
| `libs/versioning/src/commits/parse/header.spec.ts`                | Add multi-scope header cases; update single-scope cases to expect array                                                                                                                                                                            |
| `libs/versioning/src/commits/parse/message.ts`                    | Propagate array shape through message-level parse                                                                                                                                                                                                  |
| `libs/versioning/src/commits/parse/message.spec.ts`               | Update assertions                                                                                                                                                                                                                                  |
| `libs/versioning/src/commits/classify/project-scopes.ts`          | Treat `commit.scope` as `readonly string[]`; a commit matches a project if **any** scope element matches the project name                                                                                                                          |
| `libs/versioning/src/commits/classify/project-scopes.spec.ts`     | Add multi-scope classification cases                                                                                                                                                                                                               |
| `libs/versioning/src/commits/classify/classifier.ts`              | Update any `scope` deref to iterate array                                                                                                                                                                                                          |
| `libs/versioning/src/commits/classify/classifier.spec.ts`         | Update fixtures                                                                                                                                                                                                                                    |
| `libs/versioning/src/commits/classify/infrastructure.ts`          | Same                                                                                                                                                                                                                                               |
| `libs/versioning/src/commits/classify/infrastructure.spec.ts`     | Same                                                                                                                                                                                                                                               |
| `libs/versioning/src/changelog/operations/transform.ts`           | If scope is surfaced in changelog output, render `a, b` for multi-scope                                                                                                                                                                            |
| `libs/versioning/src/changelog/operations/filter-by-predicate.ts` | Update scope predicate helpers                                                                                                                                                                                                                     |
| `libs/versioning/src/changelog/compare/diff.ts`                   | Array-aware equality                                                                                                                                                                                                                               |
| `libs/versioning/src/changelog/compare/is-equal.ts`               | Array-aware equality                                                                                                                                                                                                                               |
| `libs/versioning/src/changelog/serialize/to-json.ts`              | Serialize as array                                                                                                                                                                                                                                 |
| `libs/versioning/src/changelog/serialize/to-string.ts`            | Render multi-scope when present                                                                                                                                                                                                                    |
| `libs/versioning/src/flow/steps/analyze-commits.ts`               | Array-aware reads                                                                                                                                                                                                                                  |
| `libs/versioning/src/flow/steps/analyze-commits.spec.ts`          | Update                                                                                                                                                                                                                                             |
| `libs/versioning/src/flow/steps/generate-changelog.ts`            | Array-aware reads                                                                                                                                                                                                                                  |
| `libs/versioning/src/flow/flow.spec.ts`                           | Update fixtures                                                                                                                                                                                                                                    |
| `libs/versioning/src/flow/executor/execute.spec.ts`               | Update fixtures                                                                                                                                                                                                                                    |
| `tools/package/src/executors/version/executor.ts`                 | Audit any `.scope` reads; update to array semantics                                                                                                                                                                                                |
| `tools/package/src/executors/version-check/executor.ts`           | Same                                                                                                                                                                                                                                               |
| `libs/versioning/src/commits/README.md`                           | Document the breaking change and new shape                                                                                                                                                                                                         |
| `libs/versioning/CHANGELOG.md`                                    | Record as `BREAKING CHANGE` (will happen automatically via Phase 7 commit, but verify entry post-release)                                                                                                                                          |

### Search scope for audit (do not miss consumers)

```bash
# Use these exact searches to catch every .scope read
Grep "\.scope" libs/versioning/src
Grep "\.scope" tools/package/src
Grep "commit\.scope" libs
Grep "ConventionalCommit" libs tools
```

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx test @hyperfrontend/package
npx nx lint @hyperfrontend/package --fix
npx nx typecheck @hyperfrontend/package
npx nx format:write --projects=@hyperfrontend/versioning,@hyperfrontend/package
```

**Acceptance:** All existing tests pass with `readonly string[]`. `parseHeader('feat(a,b): x')` returns `{ scope: ['a', 'b'] }`. `createConventionalCommit('feat', 'x', { scope: ['a', 'b'] })` emits `feat(a,b): x`. Serialize/diff/classify handle arrays correctly.

---

## Phase 3 — Foundation: `commits/validate/` pure rule engine

Commitlint-equivalent, pure, unit-testable without a TTY. Consumed by (a) inline step validators in Phase 5, (b) preview warnings in Phase 5, (c) the `cl` bin in Phase 6.

### Files to create

| Path                                                                   | Purpose                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/src/commits/validate/index.ts`                        | Public exports                                                                                                                                                                                                             |
| `libs/versioning/src/commits/validate/models/rule.ts`                  | Types: `RuleLevel` (`'off' \| 'warn' \| 'error'`), `Rule<TOptions>`, `RuleContext`, `RuleResult` (`{ level, message }[]`)                                                                                                  |
| `libs/versioning/src/commits/validate/models/rule.spec.ts`             | Type-only file, minimal runtime tests if any                                                                                                                                                                               |
| `libs/versioning/src/commits/validate/models/ruleset.ts`               | Types: `Ruleset` (map of rule name → `[level, options?]`), `ValidationResult` (`{ valid, warnings, errors }`)                                                                                                              |
| `libs/versioning/src/commits/validate/rules/type-enum.ts`              | Rule: commit type must be in configured enum                                                                                                                                                                               |
| `libs/versioning/src/commits/validate/rules/type-enum.spec.ts`         |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/scope-enum.ts`             | Rule: each scope in `commit.scope: readonly string[]` must be in configured enum (or array is empty if scope is optional)                                                                                                  |
| `libs/versioning/src/commits/validate/rules/scope-enum.spec.ts`        |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/subject-case.ts`           | Rule: subject matches one of `['sentence-case', 'lower-case', 'upper-case', 'kebab-case', 'snake-case', 'start-case']`. Dogfood sets this to `off`                                                                         |
| `libs/versioning/src/commits/validate/rules/subject-case.spec.ts`      |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/subject-empty.ts`          | Rule: subject must be non-empty                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/subject-empty.spec.ts`     |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/header-max-length.ts`      | Rule: `type(scope)!: subject` ≤ configured length (default 72). Options: `{ maxLength: number \| null }` (null = disabled)                                                                                                 |
| `libs/versioning/src/commits/validate/rules/header-max-length.spec.ts` |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/rules/imperative-mood.ts`        | Rule: first subject word case-insensitive match against past-tense wordlist → warn. Options: `{ wordlist?: Record<string, string> }` (word → suggested imperative)                                                         |
| `libs/versioning/src/commits/validate/rules/imperative-mood.spec.ts`   | Cover: `added`, `updated`, `fixed`, `removed`, `changed`, `modified`, `created`, `deleted`, `improved`, `refactored`, `implemented`, `renamed`, `moved`                                                                    |
| `libs/versioning/src/commits/validate/rules/index.ts`                  | Barrel                                                                                                                                                                                                                     |
| `libs/versioning/src/commits/validate/engine.ts`                       | `validateCommit(commit: ConventionalCommit, ruleset: Ruleset): ValidationResult` — iterates rules, aggregates warnings/errors                                                                                              |
| `libs/versioning/src/commits/validate/engine.spec.ts`                  | End-to-end ruleset execution tests                                                                                                                                                                                         |
| `libs/versioning/src/commits/validate/validate-message.ts`             | `validateCommitMessage(raw: string, ruleset: Ruleset): ValidationResult` — parses with `parseCommitMessage()` then runs engine. Used by `cl` bin                                                                           |
| `libs/versioning/src/commits/validate/validate-message.spec.ts`        |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/presets/conventional.ts`         | Default ruleset equivalent to `@commitlint/config-conventional` baseline: `type-enum` (error), `subject-empty` (error), `scope-enum` (off), `subject-case` (off), `header-max-length` (warn, 72), `imperative-mood` (warn) |
| `libs/versioning/src/commits/validate/presets/conventional.spec.ts`    |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/validate/README.md`                       | Architecture note; rule authoring guide                                                                                                                                                                                    |

### Files to modify

| Path                                   | Change                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `libs/versioning/src/commits/index.ts` | Re-export from `./validate`                                                |
| `libs/versioning/src/index.ts`         | Add `./commits/validate` exports + types                                   |
| `libs/versioning/package.json`         | Add `"./commits/validate": "./src/commits/validate/index.js"` to `exports` |

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx format:write --projects=@hyperfrontend/versioning
```

**Acceptance:** `validateCommit()` and `validateCommitMessage()` return structured results. All rule unit tests pass. `validateCommitMessage('feat: add x', conventionalPreset).valid === true`. `validateCommitMessage('feat: added x', conventionalPreset).warnings` includes the imperative-mood hint.

---

## Phase 4 — Foundation: `commits/format/` preview formatter

Pure formatter that renders a `ConventionalCommit` (or in-progress draft) into the final message string as it would be written to `.git/COMMIT_EDITMSG`. Used by the `preview` step in Phase 5.

### Files to create

| Path                                                        | Purpose                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/versioning/src/commits/format/index.ts`               | Public exports                                                                                                                                                                                                     |
| `libs/versioning/src/commits/format/models/draft.ts`        | `CommitDraft` type: partial version of `ConventionalCommit` used during authoring (fields accumulated step by step)                                                                                                |
| `libs/versioning/src/commits/format/format-message.ts`      | `formatCommitMessage(draft: CommitDraft): string` — assembles header + blank line + body + blank line + footers. Handles: optional scope(s), `!` breaking marker, `BREAKING CHANGE:` footer, issue-closing footers |
| `libs/versioning/src/commits/format/format-message.spec.ts` | Matrix: header only; header + body; header + footers; header + body + footers; breaking with `!` + `BREAKING CHANGE:` footer; multi-scope joined with `,`                                                          |
| `libs/versioning/src/commits/format/format-header.ts`       | `formatHeader(draft): string` — isolated header builder, reusable for live-countdown render in the subject step                                                                                                    |
| `libs/versioning/src/commits/format/format-header.spec.ts`  |                                                                                                                                                                                                                    |
| `libs/versioning/src/commits/format/count-header.ts`        | `countHeaderLength(draft, subject: string): number` — computes final header length including `type(a,b)!: ` prefix, for live countdown                                                                             |
| `libs/versioning/src/commits/format/count-header.spec.ts`   |                                                                                                                                                                                                                    |
| `libs/versioning/src/commits/format/README.md`              | Short doc                                                                                                                                                                                                          |

### Files to modify

| Path                                   | Change                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `libs/versioning/src/commits/index.ts` | Re-export from `./format`                                              |
| `libs/versioning/src/index.ts`         | Add `./commits/format` exports + types                                 |
| `libs/versioning/package.json`         | Add `"./commits/format": "./src/commits/format/index.js"` to `exports` |

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx format:write --projects=@hyperfrontend/versioning
```

**Acceptance:** `formatCommitMessage({ type: 'feat', scope: ['versioning', 'questions'], subject: 'add x', breaking: true, breakingDescription: 'removed Y', footers: [{ key: 'Closes', value: '#1' }]})` produces a well-formed multi-scope breaking-change message.

---

## Phase 5 — Core: `commits/author/` session runner

The interactive authoring capability. Depends on Phase 1 (searchable select), Phase 2 (array-scope model), Phase 3 (validate), Phase 4 (format), plus existing `@hyperfrontend/questions` and `@hyperfrontend/project-scope`.

### Files to create

#### Models

| Path                                                               | Purpose                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/versioning/src/commits/author/models/session-config.ts`      | `SessionConfig`: `types`, `scopeFilter`, `scopeOptional`, `scopeMulti`, `stagedPathsProvider`, `cwd`, `headerMaxLength`, `imperativeWordlist`, `skipCommit`, `commitExecutor`, `validateRuleset` |
| `libs/versioning/src/commits/author/models/session-config.spec.ts` |                                                                                                                                                                                                  |
| `libs/versioning/src/commits/author/models/session-context.ts`     | `SessionContext`: mutable-in-draft container threaded through steps — `{ draft: CommitDraft, candidateScopes: readonly string[], defaultScope: string \| undefined, config }`                    |
| `libs/versioning/src/commits/author/models/step.ts`                | `type Step = (ctx: SessionContext) => Promise<StepResult>`. `StepResult`: `{ status: 'done' \| 'cancelled' \| 'goto', gotoStepId?: string }`                                                     |
| `libs/versioning/src/commits/author/models/session-outcome.ts`     | `SessionOutcome`: `{ status: 'committed' \| 'cancelled', message?: string, error?: Error }`                                                                                                      |

#### Resolvers (pure, non-prompt)

| Path                                                                   | Purpose                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/src/commits/author/resolvers/staged-paths.ts`         | Default `stagedPathsProvider`: shells out to `git diff --cached --name-only -z`, splits on NUL, filters empty. Uses versioning's existing `git/` module shell helper                                                                |
| `libs/versioning/src/commits/author/resolvers/staged-paths.spec.ts`    | Mock-based                                                                                                                                                                                                                          |
| `libs/versioning/src/commits/author/resolvers/scope-discovery.ts`      | `discoverScopes(stagedPaths, { scopeFilter, cwd })`: for each staged path, walk up via `findProjectRoot`; read `project.json:name`; union the set. Applies `scopeFilter` after collection. Built-in exclude: `node_modules`, `.git` |
| `libs/versioning/src/commits/author/resolvers/scope-discovery.spec.ts` | Fixtures under `libs/versioning/__fixtures__/scope-discovery/`                                                                                                                                                                      |
| `libs/versioning/src/commits/author/resolvers/default-scope.ts`        | Implements the D3 algorithm: (1) single owner, (2) nearest common ancestor, (3) none                                                                                                                                                |
| `libs/versioning/src/commits/author/resolvers/default-scope.spec.ts`   |                                                                                                                                                                                                                                     |

#### Steps

| Path                                                             | Step                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/src/commits/author/steps/resolve-scope.ts`      | Non-prompt. Calls `config.stagedPathsProvider()` → `discoverScopes()` → `defaultScope()`. On empty staging: returns `{ status: 'cancelled' }` with error "No staged changes; stage something first."                       |
| `libs/versioning/src/commits/author/steps/resolve-scope.spec.ts` |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/type.ts`               | `select({ searchable: true, choices: types, default: existingDraftType })`                                                                                                                                                 |
| `libs/versioning/src/commits/author/steps/type.spec.ts`          |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/scope.ts`              | If `ctx.candidateScopes.length === 0 && !config.scopeOptional`: error. Else: `select({ searchable: true, choices: candidateScopes, default: defaultScope })`. If `scopeOptional && single option === empty sentinel`, skip |
| `libs/versioning/src/commits/author/steps/scope.spec.ts`         |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/subject.ts`            | `text({ validate: ..., transform: (value) => renderCountdown(value, draft) })`. Validators from `commits/validate/` (subject-empty error; header-max-length warn). Imperative hint inline                                  |
| `libs/versioning/src/commits/author/steps/subject.spec.ts`       |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/body.ts`               | `text({ required: false, multiline: false })`                                                                                                                                                                              |
| `libs/versioning/src/commits/author/steps/body.spec.ts`          |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/breaking.ts`           | `confirm()`; on yes → `text()` for description; writes to `draft.breaking` + `draft.breakingDescription` + appends `BREAKING CHANGE:` footer                                                                               |
| `libs/versioning/src/commits/author/steps/breaking.spec.ts`      |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/issues.ts`             | `confirm()`; on yes → `text()` for refs; parses `fix #123, re #456` into footers                                                                                                                                           |
| `libs/versioning/src/commits/author/steps/issues.spec.ts`        |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/preview.ts`            | Non-prompt render via `formatCommitMessage()`. `confirm({ message: 'Commit this message?' })`. On no → `{ status: 'goto', gotoStepId: 'type' }`. Session re-enters with all draft fields as defaults                       |
| `libs/versioning/src/commits/author/steps/preview.spec.ts`       |                                                                                                                                                                                                                            |
| `libs/versioning/src/commits/author/steps/commit.ts`             | If `config.skipCommit`: no-op. Else: call `config.commitExecutor(message)`; default executor invokes `commit()` from `libs/versioning/src/git/operations/commit.ts`                                                        |
| `libs/versioning/src/commits/author/steps/commit.spec.ts`        |                                                                                                                                                                                                                            |

#### Presets + runner

| Path                                                                | Purpose                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/versioning/src/commits/author/presets/conventional.ts`        | Default ordered step list: `[resolveScope, type, scope, subject, body, breaking, issues, preview, commit]`                                                                     |
| `libs/versioning/src/commits/author/presets/conventional.spec.ts`   |                                                                                                                                                                                |
| `libs/versioning/src/commits/author/session/create-session.ts`      | `createAuthorSession({ steps?, config })` — defaults `steps` to `conventionalPreset`                                                                                           |
| `libs/versioning/src/commits/author/session/create-session.spec.ts` |                                                                                                                                                                                |
| `libs/versioning/src/commits/author/session/run-session.ts`         | `runAuthorSession(session): Promise<SessionOutcome>` — iterates steps; handles `goto`; catches `PromptCancelled` → SIGINT exit semantics; final step returns outcome           |
| `libs/versioning/src/commits/author/session/run-session.spec.ts`    | Covers: happy path; Ctrl-C at each step; preview-cancel-and-restart; empty-staging refuse                                                                                      |
| `libs/versioning/src/commits/author/config-loader/load.ts`          | `loadCommitConfig({ cwd, overridePath? })`: searches for `commit.config.{js,mjs,cjs}` from cwd upward; validates shape; returns a `SessionConfig`. Handles `--config` override |
| `libs/versioning/src/commits/author/config-loader/load.spec.ts`     |                                                                                                                                                                                |
| `libs/versioning/src/commits/author/index.ts`                       | Public exports                                                                                                                                                                 |
| `libs/versioning/src/commits/author/README.md`                      | Architecture overview + usage                                                                                                                                                  |

### Files to modify

| Path                                   | Change                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/versioning/src/commits/index.ts` | Re-export from `./author`                                                                                                                                    |
| `libs/versioning/src/index.ts`         | Add `./commits/author` exports + types                                                                                                                       |
| `libs/versioning/package.json`         | Add `"./commits/author": "./src/commits/author/index.js"` to `exports`. Add `"@hyperfrontend/questions": "<version>"` to `dependencies` (bundled at publish) |
| `libs/versioning/project.json`         | Ensure build config bundles `@hyperfrontend/questions` (rollup externals exclude it so it's inlined, consistent with other internal deps)                    |

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx build @hyperfrontend/versioning
npx nx format:write --projects=@hyperfrontend/versioning
```

Additional manual smoke test (in-repo, pre-bin-registration):

```bash
# From the repo root, exercise the API directly
node -e "
const { createAuthorSession, runAuthorSession, conventionalPreset } = require('./libs/versioning/src/commits/author')
const session = createAuthorSession({ config: { types: [...], scopeOptional: false, skipCommit: true } })
runAuthorSession(session).then(o => console.log(o))
"
```

**Acceptance:** End-to-end session runs in-process with `skipCommit: true` and returns the correctly formatted message string. Ctrl-C exits 130. Empty-staging refuse path works. Preview cancel returns user to type step with draft pre-filled.

---

## Phase 6 — Integration: `cz` and `cl` bin entry points

Register two CLI entry points on `@hyperfrontend/versioning` so `npx cz` and `npx cl $1` work from any consumer project.

### Files to create

| Path                                 | Purpose                                                                                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/src/bin/cz.ts`      | Entry for `cz`. Parses argv (`--config`, `--cwd`). Loads config via `loadCommitConfig()`. Creates + runs session. Maps `SessionOutcome` to process exit: committed → 0; cancelled (Ctrl-C) → 130; error → 1 |
| `libs/versioning/src/bin/cz.spec.ts` | Thin argv + outcome-to-exit mapping tests                                                                                                                                                                   |
| `libs/versioning/src/bin/cl.ts`      | Entry for `cl`. Reads commit-msg file path from argv[2]. `readFileSync` → `validateCommitMessage(contents, ruleset)`. Loads ruleset from config. Prints structured warnings/errors. Exits 0/1               |
| `libs/versioning/src/bin/cl.spec.ts` |                                                                                                                                                                                                             |
| `libs/versioning/src/bin/README.md`  | Short doc with usage                                                                                                                                                                                        |

### Files to modify

| Path                           | Change                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/versioning/package.json` | Add `"bin": { "cz": "./src/bin/cz.js", "cl": "./src/bin/cl.js" }`. Ensure `"files"` (if present) includes bin entries. Shebang (`#!/usr/bin/env node`) must be preserved by rollup build                       |
| `libs/versioning/project.json` | If build target needs additional entry points for bins, configure them (two additional rollup inputs or a separate esbuild-bin target). Bins must have `#!/usr/bin/env node` and be `chmod +x` at publish time |

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx build @hyperfrontend/versioning

# Sanity: after build, check bins exist and are executable
ls -l dist/libs/versioning/bin/cz.js dist/libs/versioning/bin/cl.js
head -1 dist/libs/versioning/bin/cz.js  # must be '#!/usr/bin/env node'
```

**Acceptance:** Built output contains two executable files with the correct shebang. Running them directly from `dist/` starts the session / validator with the expected behavior.

---

## Phase 7 — Integration: monorepo dogfood migration

Replaces the existing commitizen/commitlint wiring with the new bins and config. This phase is the end-to-end cutover — each sub-step is individually reversible until file deletions in the last sub-step.

### Sub-phase 7.1 — Add workspace-root `commit.config.js`

**Create** `/workspaces/hyperfrontend/commit.config.js` with dogfood configuration:

```js
// Shape (illustrative — implementation defines the exact SessionConfig type):
module.exports = {
  // Type enum — full Conventional Commits default list
  types: [
    { name: 'feat', description: 'A new feature' },
    { name: 'fix', description: 'A bug fix' },
    { name: 'docs', description: 'Documentation only changes' },
    { name: 'style', description: 'Changes that do not affect code meaning (whitespace, formatting)' },
    { name: 'refactor', description: 'A code change that neither fixes a bug nor adds a feature' },
    { name: 'perf', description: 'A code change that improves performance' },
    { name: 'test', description: 'Adding missing tests or correcting existing tests' },
    { name: 'build', description: 'Changes that affect the build system or external dependencies' },
    { name: 'ci', description: 'Changes to CI configuration files and scripts' },
    { name: 'chore', description: 'Other changes that do not modify src or test files' },
    { name: 'revert', description: 'Reverts a previous commit' },
  ],

  // Scope is required for this repo; no skip
  scopeOptional: false,

  // Dogfood restricts to single scope selection
  scopeMulti: false,

  // Exclude lib-project-scope fixture projects from scope list
  scopeFilter: ({ path }) => !path.includes('/libs/project-scope/__fixtures__/'),

  // Validation ruleset — extends the conventional preset with dogfood tweaks
  validate: {
    extends: 'conventional',
    rules: {
      'subject-case': ['off'], // allow uppercase
      'header-max-length': ['warn', { maxLength: 72 }],
      'imperative-mood': ['warn'],
    },
  },
}
```

### Sub-phase 7.2 — Update lefthook

**Modify** `/workspaces/hyperfrontend/lefthook.yml`:

```yaml
commit-msg:
  commands:
    commitlint:
      run: npx cl $1
      fail_text: 'Your commit message does not follow the standard conventional commit format. See https://www.conventionalcommits.org/en/v1.0.0/'
```

Verify before proceeding:

```bash
# Smoke-test the new validator against a recent commit message
git log --format=%B -1 HEAD > /tmp/msg.txt
npx cl /tmp/msg.txt
echo "exit: $?"
```

### Sub-phase 7.3 — Update `package.json`

**Modify** `/workspaces/hyperfrontend/package.json`:

- `scripts.commit`: keep `"npx cz"` (no change — bin name is the same; resolution now hits `@hyperfrontend/versioning` in `node_modules/.bin`)
- `scripts.postinstall`: **remove** (`patch-package` no longer needed)
- `config.commitizen`: **remove** block entirely
- `devDependencies`: **remove** `@commitlint/cli`, `@commitlint/config-conventional`, `commitizen`, `cz-conventional-changelog`, `patch-package`
- `devDependencies`: ensure `@hyperfrontend/versioning` is present (it may already be, transitively via executor; verify)

Run:

```bash
npm i
# Verify lockfile removed all five packages and their transitives
git diff package-lock.json | head -40
```

Smoke-test end-to-end:

```bash
# Stage a trivial change and walk through a commit interactively
git add -p  # or stage some test file
npx cz
```

### Sub-phase 7.4 — Delete replaced files

Only after 7.1–7.3 verify clean, remove:

| Path                                                                      | Action                    |
| ------------------------------------------------------------------------- | ------------------------- |
| `/workspaces/hyperfrontend/tools/scripts/commitizen.js`                   | Delete                    |
| `/workspaces/hyperfrontend/commitlint.config.js`                          | Delete                    |
| `/workspaces/hyperfrontend/patches/cz-conventional-changelog+3.3.0.patch` | Delete                    |
| `/workspaces/hyperfrontend/patches/`                                      | Delete directory if empty |

### Verification

```bash
npx nx test @hyperfrontend/versioning
npx nx lint @hyperfrontend/versioning --fix
npx nx typecheck @hyperfrontend/versioning
npx nx build @hyperfrontend/versioning
npx nx format:write

# Full pre-push checklist
npx nx affected -t=typecheck
npx nx affected -t=lint
npx nx affected -t=test
npx nx affected -t=build

# End-to-end author flow
# Stage a file, then:
npx cz
# Verify: searchable/scrollable type + scope prompts, 72-char countdown, preview, commit happens

# End-to-end validator flow
git log --format=%B -1 HEAD > /tmp/msg.txt
npx cl /tmp/msg.txt

# Verify lefthook wiring
git commit --allow-empty -m "chore: test hook"
# Should pass; then try:
git commit --allow-empty -m "not conventional"
# Should fail with cl's error output
```

**Acceptance:**

- `npx cz` runs the new session end-to-end and produces a conforming commit.
- `git commit` direct (bypassing `cz`) still triggers `cl` via the commit-msg hook, blocking non-conventional messages.
- `package-lock.json` diff shows removal of the five packages + their transitive dependencies.
- `node_modules/patch-package`, `node_modules/commitizen`, `node_modules/cz-conventional-changelog`, `node_modules/@commitlint` directories are gone.
- `tools/scripts/commitizen.js`, `commitlint.config.js`, `patches/cz-conventional-changelog+3.3.0.patch` are deleted.
- Commit that ships this work includes a `BREAKING CHANGE:` footer (for the `ConventionalCommit.scope` type change). `@hyperfrontend/versioning`'s own version flow will pick this up on the next publish.

---

## Risks and Unknowns

### Risks

1. **Build-tool shebang preservation.** The rollup build for `@hyperfrontend/versioning` must preserve `#!/usr/bin/env node` at the top of bin outputs and mark them executable. Current rollup config builds only `src/index.ts`; bins require additional entry points and possibly a `rollup-plugin-add-shebang` or a custom banner. **Validate early in Phase 6 — cheap to check, costly to discover at publish time.**

2. **Bundling `@hyperfrontend/questions` into `@hyperfrontend/versioning`.** Current internal deps (`immutable-api-utils`, `json-utils`, `logging`, `project-scope`) are declared in `dependencies` and presumably treated as externals. `lib-questions` must either (a) be declared similarly and bundled at publish via the same mechanism, or (b) remain external and `@hyperfrontend/versioning` simply requires it at install time. **Confirm which convention the repo uses before Phase 5; mismatch causes consumer-install failures.**

3. **Breaking-change blast radius for `ConventionalCommit.scope`.** Phase 2 grep audit is thorough on paper; unknown consumers outside the monorepo (any published consumer of `@hyperfrontend/versioning`) will get a type error on update. Mitigation: the shipping commit's `BREAKING CHANGE:` footer + CHANGELOG entry clearly documents the migration path (`commit.scope` was optional string → is now required array; empty = no scope).

4. **Terminal testability for Phase 5.** `commits/author/` session has a hard dep on lib-questions (decision C1). Unit tests must either use a fake terminal / choice injector from lib-questions or stub the prompt modules. **Confirm lib-questions exposes a test-friendly terminal or plan a thin test harness in `commits/author/__test-utils__/`.**

5. **`commit.config.js` resolution semantics.** Auto-discovery needs a clear rule: (a) current cwd only, (b) walk up to nearest config, (c) walk up to workspace root only. Inconsistency surprises users. **Pick explicitly in Phase 5 `config-loader/load.ts`; document in bin README. Recommended: start at cwd, walk up until config found OR a boundary marker (`.git`, `package.json` with `"workspaces"`) is hit.**

6. **Empty-staging error wording and exit code.** E1a says refuse with error; must match a predictable exit code (recommend 1) and a clear message. Overlaps with lefthook workflow: if someone runs `npx cz` with nothing staged, the error must be actionable.

### Unknowns to resolve during implementation (not before)

- Exact rollup/build configuration for multi-bin output (Phase 6).
- Whether `lib-questions` needs a test-time API addition for scriptable interaction (Phase 5).
- Whether `commit.config.js` should also support TypeScript (`commit.config.ts`) — defer unless trivial via existing config-loader infra.
- Whether `cl` should also support stdin input (`git log --format=%B -1 | npx cl`) in addition to a file path — low-cost addition; decide per-request.

### Out of scope

- `$EDITOR` integration for the preview step (D13c rejected).
- Draft persistence across session failures (E3b rejected).
- Multi-scope dogfood use (`scopeMulti: false` in dogfood config; multi-scope capability is shipped in the library but not exercised by the monorepo until a concrete need appears).
- `@hyperfrontend/versioning` version bump planning — self-managed by its own version flow; this plan only requires the landing commit to carry the `BREAKING CHANGE:` marker.
