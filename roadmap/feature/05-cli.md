# 05 — CLI

The `npx @hyperfrontend/features <command>` interface: `init`, `build`, `dev`.

**Depends on** [03 — Core SDK](03-core-sdk.md) and [04 — Shell Generation](04-shell-generation.md) (the `build` command drives shell generation; `dev` starts the [06 — Dev Server](06-dev-server.md)).

**Gated by** [02 — CLI/bin Execution](02-cli-bin-execution.md): the published CLI bin cannot ship until the builder-produced bin is confirmed to resolve under npm, pnpm, Yarn, and Nx.

**Consumes** `@hyperfrontend/questions` for interactive prompts (do not add a third-party prompt lib), `@hyperfrontend/project-scope` for all file I/O, `@hyperfrontend/json-utils` for reading/validating config, and `@hyperfrontend/builder` for the bin. See the [index](README.md) for shared invariants.

> This is where the design intent salvaged from the old Nx `init`/`add` generator stubs (see [01 — Reposition & Publishability](01-reposition-and-publishability.md), Phase 2.0 step 3) lands — as plain commands, not Nx generators.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first**. The CLI source obeys the same lint-enforced conventions — no enums, no direct built-in calls (use `@hyperfrontend/immutable-api-utils`), all file I/O through `@hyperfrontend/project-scope` (never `node:fs` directly) and shell calls via `execFileSync` not `execSync`, import/export ordering, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests (shared invariant 9). Fix violations preemptively.

---

## Configuration decisions

| #   | Topic             | Decision                                                                                                        |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| 13  | Config format     | Multi-format `feature.config.*`: `.json`, `.ts/.cts/.mts`, `.js/.mjs/.cjs`. **Not** JSON-only (revised).        |
| 13a | Config loading    | Tiered loader (below) — JSON via `readJsonFile`; JS/TS via native `await import()`. Zero new deps.              |
| 13b | Typed-config DX   | `$schema` for JSON; `defineConfig()` + exported `FeatureConfig` type for TS; JSDoc `@type` import for JS.       |
| 14  | Feature config    | Minimal payload: name, version, contract path — same shape regardless of source format.                         |
| 15  | Host config       | None — all programmatic in code (unchanged).                                                                    |
| 16a | CLI/config parity | Every config key is also a flag; objects passed as path strings; `--config` is the whole-config path-flag.      |
| 16b | Precedence        | `defaults < config file < flags`; a flag **replaces** its whole top-level key (shallow, no deep-merge).         |
| 16c | Non-interactive   | Every `init` prompt has a matching flag; `--ci`/`--yes` suppress prompts, error on any unresolved required key. |

> **Inline-in-entry config was considered and rescinded.** A feature definition always comes from a side-effect-free config file (or flags), never the UI entry that mounts the app — so `build`/`dev` can resolve config without executing app/DOM/handshake side effects.

> Build-time security enforcement (decision 28 — production must pick `v1` or `v2`) is applied by the `build` command. See [03 — Core SDK](03-core-sdk.md) for the security decisions.

---

## Config resolution — tiered loader (decision 13/13a)

`feature.config.*` (and the `dev` command's `hf-dev.config.*`, see [06](06-dev-server.md)) resolve through one tiered loader, reusing the existing precedent in `libs/versioning/src/commits/author/config-loader/load.ts` (native `await import()` + `pathToFileURL`, no jiti/esbuild/bundling):

| Ext             | Mechanism                                       | Cost / constraint                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.json`         | `readJsonFile` (`@hyperfrontend/project-scope`) | none                                                                                                                                                                                                                                                                 |
| `.js/.mjs/.cjs` | native `await import(pathToFileURL(abs).href)`  | none — universal across Node versions                                                                                                                                                                                                                                |
| `.ts/.cts/.mts` | native `await import()` (Node type-stripping)   | **erasable syntax only** (no enums — already lint-banned; no `namespace`/param-properties); consumer Node ≥ 23.6 (unflagged) or ≥ 22.6 (flagged). Gate via `engines` + clear error. Enum-requiring TS (`--experimental-transform-types`) is **out of scope for v1**. |

The loader returns the module's `default` export (or the JSON object). The **resolved object is runtime-validated regardless of source format** (shared with contract validation, decision 19 in [04](04-shell-generation.md)) — TS/JS does not skip validation.

## Typed-config DX (decision 13b)

The reason to support non-JSON config is type-checked authoring, not the file extension:

- **JSON** — `"$schema": "https://hyperfrontend.dev/schemas/feature.config.json"`.
- **TypeScript** — export `FeatureConfig` (type) and a pure `defineConfig()` identity helper from `@hyperfrontend/features` (see [03](03-core-sdk.md)). `defineConfig` is `(c: FeatureConfig) => FeatureConfig` — inference only, **never** runtime behavior (it is not the rescinded inline `defineFeature`).
  ```ts
  import { defineConfig } from '@hyperfrontend/features'
  export default defineConfig({ name: 'clock', version: '1.0.0', contract: './contracts/clock.contract.ts' })
  ```
- **JavaScript** — same `defineConfig`, or a JSDoc type import for editors without it:
  ```js
  /** @type {import('@hyperfrontend/features').FeatureConfig} */
  export default { name: 'clock', version: '1.0.0', contract: './contracts/clock.contract.json' }
  ```

## CLI/config parity (decisions 16a–16c)

Parity holds at **key/object granularity**, not per-nested-leaf:

- **Scalar keys → inline flag**: `--name clock`, `--version 1.0.0`, `--protocol v2`, `--out ./dist`.
- **Object/array keys → path-string flag**, resolved by the same tiered loader: `--contract ./contracts/clock.contract.ts`. `--config ./feature.config.ts` is this same rule applied to the whole config object.
- **No flag per nested leaf** (no `--dialog-width`); nested objects stay path-flags or live in the file.
- **Precedence**: `defaults < config file < flags`; a flag replaces its whole top-level key (no deep-merge from flags).
- **Non-interactive**: `--ci`/`--yes` runs the full surface headlessly — every `init` prompt has a matching flag; error if a required key is unresolved.

---

## Phase 4.1 — CLI Commands

**Files to create:**

- `libs/features/src/cli/bin.ts`
- `libs/features/src/cli/index.ts`
- `libs/features/src/cli/commands/index.ts`
- `libs/features/src/cli/commands/init.ts`
- `libs/features/src/cli/commands/build.ts`
- `libs/features/src/cli/commands/dev.ts`
- `libs/features/src/cli/prompts.ts`

**CLI Commands:**

```bash
# Initialize a feature app
npx @hyperfrontend/features init
# Interactive prompts: name, contract path

# Build shell package
npx @hyperfrontend/features build
# Reads feature.config.json, generates shell, bundles

# Start dev server
npx @hyperfrontend/features dev
# Serves feature + debug UI
```

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## Config schema — `feature.config.json`

Minimal (decision 14): name, version, contract path.

```json
{
  "$schema": "https://hyperfrontend.dev/schemas/feature.config.json",
  "name": "clock",
  "version": "1.0.0",
  "contract": "./contracts/clock.contract.json"
}
```

> The `dev` command's server config (`hf-dev.config.json`) is documented in [06 — Dev Server](06-dev-server.md). The `*.contract.json` schema lives in [04 — Shell Generation](04-shell-generation.md).

## Final review (before marking this plan complete)

After the CLI code changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- ~~Confirm the argument/flag surface for each command (`--config`, `--out`, non-interactive mode).~~ **Resolved** — full key/object-granularity parity, path-string flags for objects, `--ci` non-interactive (decisions 16a–16c above).
- The tiered loader is shared by `build` and `dev` ([06](06-dev-server.md)); decide whether it lives as a small internal module in `libs/features` reusing the `libs/versioning` pattern, or is extracted to a shared util — do not duplicate it across the two commands.
- Decide how `init` scaffolds a feature vs. a shell, and whether it reuses the `@hyperfrontend/questions` prompt flow end-to-end (every prompt must still have a matching flag per decision 16c).
