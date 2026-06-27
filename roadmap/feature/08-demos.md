# 08 — Demos (Clock, Heartbeat, Views)

Three feature apps that prove the architecture end-to-end and validate the framework-agnostic claim, in order: **Clock (Vue) → Heartbeat (React) → Views (Vanilla JS)**.

**Depends on** the Core SDK, Shell Generation, and CLI — **all complete** (each demo is built into a shell via `features build`). Embedded into the docs site in [09 — Docs-Site Integration](09-docs-site-integration.md); deployed per [10 — Deployment](10-deployment.md).

See the [index](README.md) for shared invariants.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — the hand-written demo app source obeys the same lint-enforced conventions (shared invariant 9). Fix violations preemptively.

> **Don't hand-author generated files (shared invariant 10).** The SDK, shell generator, and CLI have all shipped, so the prerequisites are in place. The `shell/*` files listed under each demo are **generated output of `features build`**, not files to write by hand — don't fill them in manually or edit the protected core. Defer each demo's docs until its feature app actually runs.

---

## Demo decisions

| #   | Topic          | Decision                                          |
| --- | -------------- | ------------------------------------------------- |
| 37  | Demo order     | Clock (Vue) → Heartbeat (React) → Views (Vanilla) |
| 38  | Demo host      | Docs site (`apps/docs-site/`)                     |
| 39  | Demo routes    | Next.js pages that embed features via shell       |
| 40  | Landing page   | Carousel with live embedded previews              |
| 41  | Shell packages | Local workspace builds (not npm-published)        |

> Decisions 38–40 are executed in [09 — Docs-Site Integration](09-docs-site-integration.md); decisions 42–43 (feature/docs deployment targets) in [10 — Deployment](10-deployment.md).

Clock (Vue) proves the architecture end-to-end; Heartbeat (React) and Views (Vanilla JS) validate the framework-agnostic claim. Shell packages are local workspace builds, consumed by the docs site as `workspace:*` deps (decision 41).

---

## Phase 7 — Clock Demo (Vue)

### 7.1 Create Clock Feature App

**Files to create:**

- `apps/demos/clock/package.json`
- `apps/demos/clock/project.json`
- `apps/demos/clock/feature.config.json`
- `apps/demos/clock/contracts/clock.contract.json`
- `apps/demos/clock/src/main.ts`
- `apps/demos/clock/src/App.vue`
- `apps/demos/clock/src/clock.ts` (feature initialization)
- `apps/demos/clock/index.html`
- `apps/demos/clock/vite.config.ts`

**Contract:**

```json
{
  "name": "clock",
  "version": "1.0.0",
  "emitted": [
    { "type": "timeUpdated", "description": "Emitted every second with current time" },
    { "type": "timezoneChanged", "description": "Emitted when timezone changes" }
  ],
  "accepted": [
    { "type": "setTimezone", "description": "Set the clock timezone" },
    { "type": "setFormat", "description": "Set 12h or 24h format" }
  ]
}
```

### 7.2 Generate Clock Shell

**Files generated (by `features build`):**

- `apps/demos/clock/shell/shell.core.ts`
- `apps/demos/clock/shell/shell.config.ts`
- `apps/demos/clock/shell/shell.exports.ts`
- `apps/demos/clock/shell/dist/index.js`
- `apps/demos/clock/shell/dist/index.d.ts`
- `apps/demos/clock/shell/metadata.json`
- `apps/demos/clock/shell/package.json`

**Verification:**

```bash
npx nx build clock
npx nx test clock
npx nx lint clock --fix
```

---

## Phase 8 — Heartbeat Demo (React)

### 8.1 Create Heartbeat Feature App

**Files to create:**

- `apps/demos/heartbeat/package.json`
- `apps/demos/heartbeat/project.json`
- `apps/demos/heartbeat/feature.config.json`
- `apps/demos/heartbeat/contracts/heartbeat.contract.json`
- `apps/demos/heartbeat/src/main.tsx`
- `apps/demos/heartbeat/src/App.tsx`
- `apps/demos/heartbeat/src/heartbeat.ts`
- `apps/demos/heartbeat/index.html`
- `apps/demos/heartbeat/vite.config.ts`

**Contract:**

```json
{
  "name": "heartbeat",
  "version": "1.0.0",
  "emitted": [
    { "type": "pong", "description": "Response to ping" },
    { "type": "status", "description": "Health status update" }
  ],
  "accepted": [{ "type": "ping", "description": "Health check request" }]
}
```

**Verification:**

```bash
npx nx build heartbeat
npx nx test heartbeat
npx nx lint heartbeat --fix
```

---

## Phase 9 — Views Demo (Vanilla JS)

### 9.1 Create Views Feature App

**Files to create:**

- `apps/demos/views/package.json`
- `apps/demos/views/project.json`
- `apps/demos/views/feature.config.json`
- `apps/demos/views/contracts/views.contract.json`
- `apps/demos/views/src/main.ts`
- `apps/demos/views/src/views.ts`
- `apps/demos/views/index.html`
- `apps/demos/views/vite.config.ts`

**Verification:**

```bash
npx nx build views
npx nx test views
npx nx lint views --fix
```

---

## Final review (before marking this plan complete)

After each demo's code changes land, run the full gate for that demo with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all three demos pass clean (substitute `clock` / `heartbeat` / `views`):

```bash
npx nx typecheck clock --skip-nx-cache
npx nx lint clock --skip-nx-cache
npx nx test clock --skip-nx-cache
npx nx build clock --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- The Views demo contract is not yet specified — define its `emitted`/`accepted` actions before implementing.
