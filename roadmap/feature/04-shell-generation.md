# 04 — Shell Generation

Two sibling **pure generators** that turn a _resolved config + its contract_ into emitted code:

1. **Shell generator** — produces the self-contained **host connector** package (the host imports this). The connector is generic and fully data-driven; it is generated into a throwaway working tree, bundled, and packed/published. The consumer never commits or edits shell source.
2. **Feature-boilerplate generator** — produces the **hostee glue** that the feature author scaffolds into their own app. It imports `@hyperfrontend/features/hostee` (the SDK), **never** the shell package, and is derived from the same contract.

Both are pure `(resolvedConfig, contract, tree) => void` functions: they receive an already-resolved config and a parsed+validated contract, and stage output into a `Tree` (`@hyperfrontend/project-scope` VFS) supplied by the caller. **All discovery, prompting, and `commitChanges` happen in the CLI ([05](05-cli.md)) — never here.** This keeps the generators deterministic and headless (`hf build --ci` runs them with no I/O of their own beyond the staged `Tree`).

**Depends on** [03 — Core SDK](03-core-sdk.md) (the generated shell bundles `@hyperfrontend/features/host`; the feature glue imports `@hyperfrontend/features/hostee`). See the [index](README.md) for shared invariants.

**Consumes** `@hyperfrontend/project-scope` (VFS `Tree` staging — declare it in `dependencies`, import only the narrow `./vfs` / `./core/fs` subpaths so the bundle does not pull the heuristics/tech engine), `@hyperfrontend/versioning` for shell/contract version stamping in `metadata.json` (decision 26b), and `@hyperfrontend/json-utils` for runtime contract/payload validation (decision 8d).

> **New runtime deps.** `libs/features/package.json` currently declares none of `@hyperfrontend/project-scope`, `@hyperfrontend/versioning`, or `@hyperfrontend/json-utils`. All three must be added to `dependencies` (bundled by the builder per shared invariant 5). Import project-scope via its **subpath exports** (`@hyperfrontend/project-scope/vfs`), not the `.` barrel — the `.` entry drags in 50+ tech detectors and TTL-cached heuristics the generator must never touch.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first**. The generator source obeys the same lint-enforced conventions as the rest of the library — no enums, no direct built-in calls (use `@hyperfrontend/immutable-api-utils`, including for JSON read/parse over raw `JSON.parse`), import/export ordering, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests (shared invariant 9). Output is composed as TypeScript template-literal `const`s in code (no `*.template` files, no templating engine); the **emitted** code must also satisfy these conventions, so author the emitter `const`s to produce compliant output. Fix violations preemptively.

---

## Shell architecture context

The shell is an **ephemeral build artifact**, not committed source. The flow:

```
resolved config + contract
        │
        ▼
  shell generator  ──stages──▶  VFS Tree (in memory)
        │                            │
        │                   CLI commitChanges()
        │                            ▼
        │                    temp working dir  ──builder bundles──▶  packed tarball / publish
        │                            │                                        │
        └────────────────────────────┘                                        ▼
                 (temp dir removed)                               host: npm i @mycompany/clock-shell
```

The only durable artifacts the consumer owns are the **config file**, the hand-authored **`*.contract.json`**, and their **app code** (including the scaffolded feature-glue module). The host connector package below is regenerated from scratch every build — there is no protected/editable boundary to preserve.

The connector is an npm-style package the host installs. It is self-contained (zero runtime deps) with the contract inlined:

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHELL PACKAGE (generated per feature)                              │
├─────────────────────────────────────────────────────────────────────┤
│  @mycompany/clock-shell/                                             │
│  ├── package.json          # No dependencies (self-contained)       │
│  ├── dist/                                                           │
│  │   ├── index.js          # Shell SDK (bundled)                    │
│  │   ├── index.d.ts        # TypeScript declarations                │
│  │   └── index.js.map      # Source maps                            │
│  ├── metadata.json         # Contract + feature info (humans/registry)│
│  └── README.md             # Generated docs                          │
│                                                                      │
│  BUNDLED INSIDE index.js:                                            │
│  • Contract (inlined)                                                │
│  • Comms layer (nexus subset)                                       │
│  • Init/handshake protocol                                          │
│  • Display mode logic (embedded, dialog, popup, standalone)         │
│  • Lifecycle management                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Shell-generation decisions

> **Revised — the shell is now generated + ephemeral, not committed/editable.** The earlier "user can see/edit the shell source" model (old 21–24) is rescinded: generating protected source into a consumer workspace begs the question of why it lives there at all. The connector is generic and config-driven, so the consumer maintains only the config. This dissolves the entire protected/editable merge problem (former open question #1).

| #   | Topic                 | Decision                                                                                                                                                                                                                                                                                                              |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | Shell source          | **Generated + ephemeral.** Emitted into a throwaway VFS `Tree` → temp dir → bundled → packed/published. Never committed to the consumer workspace; not user-editable.                                                                                                                                                 |
| 22  | Customization surface | **The config file is the only customization surface.** No editable generated files; no protected/editable split. Connector behavior is 100% derived from the resolved config + contract.                                                                                                                              |
| 23  | Display defaults      | **Data-only**, carried in the config (e.g. `display: { dialogWidth, dialogHeight, dialogOverlay, closeOnEscape, embedSizing }`) and baked into the connector as the feature's default `ShellOptions`. The host still overrides at runtime (plan 03).                                                                  |
| 24  | Behavioral hooks      | **Not baked into the shell.** Host-presentation hooks (`onConnected`/`onError`) are the host's runtime concern via `shell.on` for the `open` / `error` / `close` events + `ShellOptions` (plan 03). Feature-side contract logic lives in the scaffolded feature-glue module (decisions 26a–26c below), not the shell. |
| 25  | Generation timing     | **Shell:** build-time, regenerated from scratch every build (overwrite-all into a fresh temp tree — trivially deterministic). **Feature glue:** one-time `init` scaffold into the app (decision 26c).                                                                                                                 |

## Feature-boilerplate (hostee-glue) decisions

The second generator emits the code that turns the consumer's app into a hostee feature. It is a **separate pure function** from the shell generator but takes the **same resolved config object**.

| #   | Topic                   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26a | What it emits           | A standalone module (e.g. `src/hyperfrontend.feature.ts`) that imports `@hyperfrontend/features/hostee`, calls `createFeature({ name, contract })`, and scaffolds contract-derived stubs: a `feature.on(<type>, …)` handler per `accepted` action and a `feature.send(<type>, …)` example per `emitted` action. It imports the contract; it does **not** import the shell package.                                                                   |
| 26b | Version stamping        | The contract/shell version (`@hyperfrontend/versioning`) is stamped into `metadata.json` and the connector; the glue module references the same `name`/`version` for parity.                                                                                                                                                                                                                                                                         |
| 26c | Insertion + idempotency | Generator emits the standalone module (write-once: `Mode.SkipIfExists`, so a re-run never clobbers handlers the author has filled in). The CLI ([05](05-cli.md)) then inserts a **single marker-guarded `import './hyperfrontend.feature'` line** into the chosen entry file; the marker makes re-runs idempotent (skip if present). Target-file discovery/selection is a CLI concern (project-scope heuristics + `questions`), not the generator's. |

## Typed surface, symmetry & validation (resolves the former symmetry/enforcement open question)

The contract is the single source of truth for **both** the connector and the hostee glue; both derive an **identical** typed surface from it (decision 8). The API stays **fluent and symmetric** — the shell offers `.open/.send/.on`, the hostee offers `.send/.on/.ready/.close` (plan 03, **unchanged** — no exhaustive handler-map was added).

| #   | Topic                | Decision                                                                                                                                                                                                                                                                                                  |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8a  | Fluent, type-checked | `feature.on(type, handler)` / `feature.send(type, data)` constrain `type` to the contract's union (typed overloads), so `.on('typo')` is a compile error. Completeness is **not** forced; the scaffolded stub-per-`accepted`-action (decision 26a) is the nudge.                                          |
| 8b  | Symmetry source      | `.ts as const` contract → both sides type via `typeof` (zero codegen). `.json` contract → `generate-types.ts` emits a `.d.ts` with the literal-`type` unions (a JSON import widens arrays to `{ type: string }[]` and loses the literals, so codegen is **required** for `.json` to be type-safe at all). |
| 8c  | Payload types        | Payload shapes are typed from a `schema` where present; type-only entries (decision 20, no schema) surface as `unknown`. (`@hyperfrontend/json-utils` cannot derive TS types from a schema — it validates at runtime only; see 8d.)                                                                       |
| 8d  | Runtime validation   | `@hyperfrontend/json-utils` `validate` / `createValidator` checks message payloads against the embedded schemas at runtime (decision 19), on **both** sides. The shared `libs/features/src/shared/contract.ts` validator wraps it. **New bundled dependency.** It does not read or stringify JSON.        |

## Contract decisions (shared with Core SDK)

| #   | Topic               | Decision                                         |
| --- | ------------------- | ------------------------------------------------ |
| 17  | Contract location   | Separate JSON file (`contracts/*.contract.json`) |
| 18  | Contract loading    | Bundled at build time (inlined in shell)         |
| 19  | Contract validation | Both build-time and runtime                      |
| 20  | Schema requirement  | Optional (type-only is fine)                     |

> The `FeatureContract` TypeScript shape these generators target is defined in [03 — Core SDK](03-core-sdk.md) (`sdk/shared/types.ts`). The contract is the **single source of truth for both sides**: the connector and the hostee glue must derive an _identical_ typed surface from the same contract (decision 8 — typed overloads). Whether that surface is derived purely at the type level (`typeof` over an `as const` `.ts` contract) or emitted as a `.d.ts` by `generate-types.ts` (for `.json` contracts), and whether TS is made to **force** the hostee author to satisfy every `accepted` action, is the open symmetry/enforcement decision below. Keep `generate-types.ts` in sync with the SDK's typed-overload generation either way.

---

## Phase 3.1 — Code emitters (no `.template` files)

**There are no `*.template` files and no templating engine.** Each generator composes its output as plain TypeScript **template-literal `const`s** inside the generator source (native template literals — not a banned built-in, no renderer, nothing to lint-exempt). Emitted into the **ephemeral** connector tree (or, for the glue module, the consumer app); nothing is a committed, user-editable artifact — the consumer's only durable customization surface is the config (decisions 21–24). The interpolated dynamic values (contract, display defaults, feature URL, action types) are computed in code; `stringify` for inlining the contract goes through `@hyperfrontend/immutable-api-utils`, never raw `JSON.stringify`.

**Connector entry (data-driven, no editable/protected split) — emitted by a `const` in `generate-shell.ts`:**

```typescript
// built in code, e.g.:  const entry = `…${stringify(contract)}…`
import { createShell } from '@hyperfrontend/features/host';

const contract = /* stringify(contract) */;
const defaults = /* stringify(displayDefaults) — decision 23 */;

export function __shellInit() {
  return createShell({ contract, url: '/* featureUrl */', ...defaults });
}
```

**Feature glue (scaffolded into the app, write-once — decision 26a/26c) — emitted by a `const` in `generate-feature-module.ts`:**

```typescript
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from './contracts/clock.contract' // contractImportPath, computed

export const feature = createFeature({ name: 'clock', contract })

// One scaffolded handler stub per `accepted` action (built by mapping contract.accepted):
feature.on('setTimezone', (data) => {
  // TODO: handle setTimezone
})
```

> **Lint note:** the emitted code must itself satisfy the library's conventions (no enums, import/export ordering, JSDoc on exported members, etc.) — the emitter `const`s are authored to produce compliant output. The TS contract is authored `as const` so both sides derive types via `typeof` (decision 8b).

---

## Phase 3.2 — Generators (shell + feature glue)

Both generators are pure `(resolvedConfig, contract, tree) => void`. They never read config/contract from disk (the CLI passes a parsed, validated `FeatureContract`), never prompt, and never `commitChanges` — they only stage into the supplied `Tree`.

**Files to create:**

- `libs/features/src/generators/shell/generate-shell.ts` — stages the connector files into the (temp-rooted) tree
- `libs/features/src/generators/shell/index.ts`
- `libs/features/src/generators/feature/generate-feature-module.ts` — stages the hostee glue module (decision 26a)
- `libs/features/src/generators/feature/index.ts`
- `libs/features/src/generators/contract/generate-types.ts` — **only** the `.json → .d.ts` bridge (decision 8b): emits the literal-`type` unions a JSON import can't preserve. `.ts as const` contracts skip it entirely (types flow via `typeof`).
- `libs/features/src/generators/metadata/generate-metadata.ts` — uses `@hyperfrontend/versioning` for version stamping (decision 26b)
- `libs/features/src/generators/index.ts`

**Generator signature (illustrative):**

```typescript
import type { Tree } from '@hyperfrontend/project-scope/vfs'

export function generateShell(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void
export function generateFeatureModule(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void
```

> **No `@nx/devkit` here.** These are plain TypeScript generators, not Nx generators — the core package is vendor-agnostic. All filesystem I/O goes through `@hyperfrontend/project-scope` (the `Tree` is its VFS), never `node:fs` directly. The temp-dir lifecycle that backs the connector tree (create → commit → bundle → remove) is owned by the CLI `build` command ([05](05-cli.md)), not by these generators.

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## On-disk contract schema

The **CLI** reads + validates this shape (via `@hyperfrontend/project-scope` `readJsonFile` + the shared validator) and passes the parsed `FeatureContract` to the generators; the generators themselves never read it from disk. Schemas are optional (decision 20); `emitted`/`accepted` entries may be type-only.

```json
{
  "name": "clock",
  "version": "1.0.0",
  "emitted": [
    {
      "type": "timeUpdated",
      "description": "Emitted every second with current time",
      "schema": {
        "type": "object",
        "properties": {
          "time": { "type": "number" },
          "timezone": { "type": "string" }
        },
        "required": ["time"]
      }
    }
  ],
  "accepted": [
    {
      "type": "setTimezone",
      "description": "Set the clock timezone",
      "schema": {
        "type": "object",
        "properties": {
          "tz": { "type": "string" }
        },
        "required": ["tz"]
      }
    }
  ]
}
```

## Final review (before marking this plan complete)

After the generator code changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- ~~The protected/editable boundary mechanism (decisions 22–24)…~~ **Resolved/dissolved.** The shell is now generated + ephemeral (decisions 21–24); there is no committed shell source to merge, so there is no protected/editable strategy to design.
- **Validator location — resolved (record in code).** Runtime contract validation (decision 19) shares logic with build-time validation. The single validator lives in `libs/features/src/shared/contract.ts`: bundled into the connector for the runtime check, and imported by the CLI `build` command for the build-time check. Neither the generators nor the CLI re-implement it.
- **JSON read vs stringify split — resolved.** One reader: `*.contract.json` and config JSON are read by the CLI via `@hyperfrontend/project-scope` `readJsonFile` (json-utils exposes no parse/stringify and is validation-only). The generators only **stringify** the already-parsed contract to inline it, via `@hyperfrontend/immutable-api-utils` (never raw `JSON.stringify`). `@hyperfrontend/json-utils` is used solely for schema validation (decision 8d). The index line that lists json-utils for "reading" config/contracts is corrected accordingly.
- ~~OPEN — contract symmetry & hostee enforcement…~~ **Resolved (decisions 8a–8d above).** Fluent + symmetric API (no exhaustive handler-map — it conflicted with the fluent goal, so plan 03 is unchanged); `type` constrained to the contract union, payloads typed from `schema` where present; symmetry via `typeof` for `.ts as const` contracts or a `generate-types` `.d.ts` for `.json`; runtime payload validation via `@hyperfrontend/json-utils` (it has no schema→type capability, so it does not affect the static surface). `generate-types.ts` is therefore needed **only** as the `.json → .d.ts` bridge.
- ~~Templating engine.~~ **Resolved — none.** Output is composed as TypeScript template-literal `const`s in the generator source; there are no `*.template` files and no renderer (Phase 3.1).
- **Connector `package.json` + `README.md` ownership — resolved.** The shell generator (04) emits the connector's source-level files into the tree — `package.json` (name/version/`type`/`exports`, zero deps), `README.md`, and `metadata.json` — since all derive from the same resolved config. `@hyperfrontend/builder` then consumes that tree, produces `dist/`, and applies its standard dependency-strip/normalize pass to the output `package.json` (per shared invariant 5). So 04 authors the source manifest; the builder finalizes the published one. No duplication.
- **Temp-dir lifecycle owner.** The connector tree commits to a temp working dir for bundling; neither VFS nor project-scope owns OS temp dirs. Confirm the CLI `build` command ([05](05-cli.md)) creates and removes it (via project-scope `core/fs` `createDirectory`/`removeDirectory`), since `node:os.tmpdir()` is permitted but `node:fs` is not.
