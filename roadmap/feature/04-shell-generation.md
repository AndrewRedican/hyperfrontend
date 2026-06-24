# 04 — Shell Generation

Templates and generators that turn a feature + its contract into a self-contained shell package the host imports.

**Depends on** [03 — Core SDK](03-core-sdk.md) (the generated shell imports `@hyperfrontend/features/host`). See the [index](README.md) for shared invariants.

**Consumes** `@hyperfrontend/versioning` for shell/contract version stamping and compatibility.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first**. The generator source obeys the same lint-enforced conventions as the rest of the library — no enums, no direct built-in calls (use `@hyperfrontend/immutable-api-utils`, including for JSON read/parse over raw `JSON.parse`), import/export ordering, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests (shared invariant 9). Note the `*.template` files are generated **output**, not library source — the conventions still apply to the code they emit, but the templating syntax (`<%= … %>`) and any banner markers inside templates are intentional. Fix violations preemptively.

---

## Shell architecture context

The build output of a feature is an npm-style package that the host installs. It is self-contained (zero runtime deps) with the contract inlined:

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

| #   | Topic               | Decision                                                |
| --- | ------------------- | ------------------------------------------------------- |
| 21  | Shell source        | Generated TypeScript (user can see/edit)                |
| 22  | Editable boundaries | Separate files (Vercel-style exports)                   |
| 23  | Protected core      | Handshake, channel creation, contract shape             |
| 24  | Customizable        | Display defaults, lifecycle hooks, message transformers |
| 25  | Generation timing   | Build-time (regenerated if contract changes)            |

## Contract decisions (shared with Core SDK)

| #   | Topic               | Decision                                         |
| --- | ------------------- | ------------------------------------------------ |
| 17  | Contract location   | Separate JSON file (`contracts/*.contract.json`) |
| 18  | Contract loading    | Bundled at build time (inlined in shell)         |
| 19  | Contract validation | Both build-time and runtime                      |
| 20  | Schema requirement  | Optional (type-only is fine)                     |

> The `FeatureContract` TypeScript shape these generators target is defined in [03 — Core SDK](03-core-sdk.md) (`sdk/shared/types.ts`). Keep `generate-types.ts` in sync with the SDK's typed-overload generation (decision 8).

---

## Phase 3.1 — Shell Templates

**Files to create:**

- `libs/features/src/generators/shell/templates/shell.core.ts.template`
- `libs/features/src/generators/shell/templates/shell.config.ts.template`
- `libs/features/src/generators/shell/templates/shell.exports.ts.template`
- `libs/features/src/generators/shell/templates/metadata.json.template`

**Template structure:**

```typescript
// shell.core.ts.template (PROTECTED - regenerated on build)
// ═══════════════════════════════════════════════════════════════
// MAINFRAME — DO NOT REMOVE OR MODIFY THIS SECTION
// ═══════════════════════════════════════════════════════════════
import { createShell } from '@hyperfrontend/features/host';

const contract = <%= JSON.stringify(contract) %>;

export function __shellInit() {
  return createShell({ contract, url: '<%= featureUrl %>' });
}
// ═══════════════════════════════════════════════════════════════

// shell.config.ts.template (USER EDITABLE)
export const dialogOptions = {
  width: 530,
  height: 550,
  overlay: true,
  closeOnEscape: true
};

export function onConnected(shell) {
  // Custom logic after connection
}

export function onError(error) {
  // Custom error handling
}
```

---

## Phase 3.2 — Shell Generator

**Files to create:**

- `libs/features/src/generators/shell/generate-shell.ts`
- `libs/features/src/generators/shell/index.ts`
- `libs/features/src/generators/contract/generate-types.ts`
- `libs/features/src/generators/metadata/generate-metadata.ts`
- `libs/features/src/generators/index.ts`

> **No `@nx/devkit` here.** These are plain TypeScript generators, not Nx generators — the core package is vendor-agnostic. All filesystem I/O goes through `@hyperfrontend/project-scope`, never `node:fs` directly.

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## On-disk contract schema

The generators read this shape. Schemas are optional (decision 20); `emitted`/`accepted` entries may be type-only.

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

- The protected/editable boundary mechanism (decisions 22–24) — how regeneration preserves user edits to `shell.config.ts` while overwriting `shell.core.ts` — needs a concrete merge/skip strategy.
- Runtime contract validation (decision 19) shares logic with build-time validation; decide where the validator lives so it isn't duplicated between the shell bundle and the CLI `build` command.
