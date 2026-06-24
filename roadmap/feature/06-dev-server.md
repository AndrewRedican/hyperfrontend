# 06 — Dev Server

A static file server plus an in-browser debug UI for testing host/hostee interactions together.

**Depends on** [03 — Core SDK](03-core-sdk.md). Started via `npx @hyperfrontend/features dev` (see [05 — CLI](05-cli.md)).

**Consumes** `@hyperfrontend/project-scope` for file I/O and `@hyperfrontend/json-utils` for config parsing. See the [index](README.md) for shared invariants.

> This is where the "dev playground" design intent salvaged from the old Nx `serve` executor stub (see [01 — Reposition & Publishability](01-reposition-and-publishability.md), Phase 2.0 step 3) lands — as a plain API/command, not an Nx executor.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first**. The server and debug-UI source obey the same lint-enforced conventions — no enums, no direct built-in calls (use `@hyperfrontend/immutable-api-utils`), file I/O through `@hyperfrontend/project-scope`, import/export ordering, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests (shared invariant 9). The debug UI uses inline styles only (no CSS files); keep that constraint while staying lint-clean. Fix violations preemptively.

---

## Dev-server decisions

| #   | Topic          | Decision                                                  |
| --- | -------------- | --------------------------------------------------------- |
| 29  | Purpose        | Serve host + hostee together for integration testing      |
| 30  | Debug UI       | At root (`/`) of dev server                               |
| 31  | Debug features | Resize, display mode toggle, message log, encryption view |
| 32  | Multi-app      | Config-based orchestration + individual commands          |
| 33  | Asset serving  | Compiled output only (not framework-specific)             |

> The security protocol selector in the debug UI surfaces the `none`/`v1`/`v2` envelope from [03 — Core SDK](03-core-sdk.md) (security decisions 26–28).

---

## Phase 5.1 — Static Server

**Files to create:**

- `libs/features/src/server/index.ts`
- `libs/features/src/server/dev-server.ts`
- `libs/features/src/server/config.ts`

---

## Phase 5.2 — Debug UI

**Files to create:**

- `libs/features/src/server/debug-ui/index.html`
- `libs/features/src/server/debug-ui/index.ts`
- `libs/features/src/server/debug-ui/controls.ts`
- `libs/features/src/server/debug-ui/message-log.ts`
- `libs/features/src/server/debug-ui/styles.ts`

**Debug UI Features:**

- Display mode switcher (embedded/dialog/popup/standalone)
- Resize controls (width/height inputs + drag handles)
- Message log (incoming/outgoing, raw/decrypted/pretty views)
- Security protocol selector (none/v1/v2)
- Connection status indicator

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## Config schema — `hf-dev.config.*`

Same multi-format support and tiered loader as `feature.config.*` (see [05 — CLI](05-cli.md), decisions 13/13a/13b): `.json` (`$schema`), `.ts/.cts/.mts` (native type-strip), `.js/.mjs/.cjs` (native `import()`). Reuse the **same loader** — do not fork it for the dev server. The resolved object is runtime-validated regardless of source format.

```json
{
  "$schema": "https://hyperfrontend.dev/schemas/hf-dev.config.json",
  "apps": [
    {
      "name": "clock",
      "outputDir": "./dist",
      "port": 3000
    }
  ],
  "debug": {
    "enabled": true,
    "messageLog": true,
    "securityView": true
  }
}
```

The TS/JS equivalent uses an exported `defineDevConfig()` + `DevConfig` type (counterpart to `defineConfig`/`FeatureConfig` in [03 — Core SDK](03-core-sdk.md)):

```ts
import { defineDevConfig } from '@hyperfrontend/features'
export default defineDevConfig({ apps: [{ name: 'clock', outputDir: './dist', port: 3000 }] })
```

CLI parity applies here too (decisions 16a–16c): `--apps ./apps.json` (object → path-string flag), scalar overrides inline, `--config ./hf-dev.config.ts` for the whole object.

## Final review (before marking this plan complete)

After the dev-server code changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- Decide the multi-app orchestration model (decision 32): how individual `dev` commands compose with config-based orchestration of several apps at once.
- The debug UI uses inline styles only (no CSS files); confirm this stays true as the UI grows.
