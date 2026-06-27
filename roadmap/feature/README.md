# @hyperfrontend/features — Implementation Plan Index

This is the navigation point and decision ledger for the `@hyperfrontend/features` plan family — the SDK, CLI, dev server, and shell generation system that powers the hyperfrontend microfrontend framework.

**Status**: Active — all prerequisite packages are published; the core `@hyperfrontend/features` SDK is the next deliverable.

This index is intentionally compact. Each linked document is a focused, independently-reasoned plan with room for finer-grained context and follow-up planning (e.g. via the `grill-me` skill). Run focused planning sessions against the individual files, not this index.

---

## What we are building

`@hyperfrontend/features` is the batteries-included layer on top of `@hyperfrontend/nexus` (cross-window messaging). Nexus handles only the communication protocol; `features` formalizes the "frontend glue code" (iframe management, display modes, lifecycle orchestration) that today exists only in legacy references. It:

- Provides a host-side SDK for embedding features.
- Provides a hostee-side SDK for feature apps.
- Generates self-contained shell packages that hosts import.
- Ships a CLI for initialization, building, and development.
- Ships a dev server with a debug UI for testing host/hostee interactions.
- Bundles its direct dependencies (nexus, network-protocol, etc.) for zero-config usage.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FEATURE APP (e.g., Clock)                                          │
├─────────────────────────────────────────────────────────────────────┤
│  • Normal app (React, Vue, Angular, Vanilla JS)                     │
│  • Knows nothing about any host                                     │
│  • Declares: "I am a feature, here's my contract"                   │
│  • Uses @hyperfrontend/features/hostee SDK                          │
│                                                                      │
│  BUILD OUTPUT: @mycompany/clock-shell (npm-style package)           │
│  • Self-contained (zero runtime deps)                               │
│  • Contract inlined in bundle                                       │
│  • metadata.json for registry/humans                                │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           │ Host installs shell package
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HOST APP                                                            │
├─────────────────────────────────────────────────────────────────────┤
│  • Any app that wants to embed features                             │
│  • Imports shell packages at build time                             │
│  • Uses shell API: shell.open(), shell.send(), shell.on()           │
│  • Controls display mode, container, lifecycle                      │
│  • Does NOT need @hyperfrontend/features as direct dep              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Recommended reading / execution order

| #   | Plan                                                 | Scope                                                                                | Notes                                                                      |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 01  | ✅ ~~Reposition & Publishability~~ — **Done**        | Move `plugins/features` → `libs/features`; promote to publishable                    | **Done.** Same package, converted identity. Plan file removed.             |
| 02  | ✅ ~~[CLI/bin Execution Research]~~ — **Done**       | Confirm `@hyperfrontend/builder` bins run under every PM                             | **Done.** All PMs pass; no builder fix needed. Gate for CLI (05) clear.    |
| 03  | ✅ ~~Core SDK~~ — **Done**                           | Shared types, Host SDK, Hostee SDK                                                   | **Done.** Plan file removed.                                               |
| 04  | ✅ ~~Shell Generation~~ — **Done**                   | Pure generators (ephemeral shell connector + hostee glue, contract types, metadata)  | **Done.** Plan file removed.                                               |
| 05  | ✅ ~~CLI~~ — **Done**                                | `init` / `build` / `dev` commands + `feature.config.*`                               | **Done.** Plan file removed.                                               |
| 06  | ✅ ~~Dev Server~~ — **Done**                         | Static server + debug UI + `hf-dev.config.*`                                         | **Done.** Plan file removed. One follow-up — see Deferred items.           |
| 07  | ✅ ~~Nx Adapter (optional)~~ — **Done**              | Opt-in Nx generators/executors, shipped inside `@hyperfrontend/features` (`src/nx/`) | **Done.** Plan file removed. (Built into the package, not a separate one.) |
| 08  | [Demos](08-demos.md)                                 | Clock (Vue) → Heartbeat (React) → Views (Vanilla JS)                                 | Proves the architecture + framework-agnostic claim.                        |
| 09  | [Docs-Site Integration](09-docs-site-integration.md) | Demo pages + landing carousel with live embeds                                       | Depends on 08.                                                             |
| 10  | [Deployment](10-deployment.md)                       | Vercel (docs) + Railway (features) + CI/CD workflows                                 | Depends on 08, 09.                                                         |
| 11  | ✅ ~~Documentation Cleanup~~ — **Done**              | Reclassified "plugin" → "package" across README + docs-site                          | **Done.** Plan file removed.                                               |

---

## Core decisions (compact ledger)

The full, topic-grouped decision tables live in the relevant plan files (cross-referenced below). This is the at-a-glance summary.

| Topic              | Decision                                                                                                                                                                                                                         | Detailed in |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Location           | `libs/features/` (publishable library, **not** an Nx plugin)                                                                                                                                                                     | 01          |
| Existing project   | Relocate + reframe `plugins/features`; do **not** greenfield                                                                                                                                                                     | 01          |
| Entry points       | Sub-path exports: `/host`, `/hostee`, `/cli`, `/server`                                                                                                                                                                          | 01, 03      |
| CLI invocation     | `npx @hyperfrontend/features <command>` (bin `hf`)                                                                                                                                                                               | 02, 05      |
| Bundling           | Direct deps (nexus, network-protocol, versioning…) bundled by builder                                                                                                                                                            | 01, 03      |
| Nx exclusivity     | Consumers do **not** need Nx; Nx is internal/optional-adapter only                                                                                                                                                               | 01, 07      |
| Shell pattern      | Singleton (nexus caches broker instances); typed overloads from contract                                                                                                                                                         | 03          |
| Display modes      | All 4 baked in (embedded, dialog, popup, standalone)                                                                                                                                                                             | 03          |
| Security default   | `protocol: 'none'` locally (opt-in); production must pick v1/v2                                                                                                                                                                  | 03          |
| Config format      | Multi-format `feature.config.*` / `hf-dev.config.*`: `.json` (`$schema`), `.ts/.cts/.mts` (native Node type-strip), `.js/.mjs/.cjs` (native `import()`); typed via exported types + `defineConfig`. No inline-in-entry.          | 05, 06      |
| CLI/config parity  | Every config key has a flag — scalars inline (`--name`), objects as path strings (`--contract ./x.ts`, `--config` = whole-object path). `defaults < file < flags`; flag replaces key; full non-interactive `--ci`.               | 05          |
| Contract           | Separate `contracts/*.contract.json`; bundled/inlined at build time                                                                                                                                                              | 04          |
| Shell source       | Generated + **ephemeral** host connector (data-driven from config; never committed/editable). A sibling generator scaffolds the **hostee glue** module into the feature app. Consumer commits only config + contract + app code. | 04          |
| Demo host & deploy | Docs-site embeds shells; features on Railway, docs on Vercel                                                                                                                                                                     | 08, 10      |

---

## Shared invariants (apply across every plan file)

These must remain true regardless of which file you are executing. Each plan restates the ones it depends on locally for correctness.

1. **Publishable & vendor-agnostic.** `@hyperfrontend/features` is a non-private, publishable package usable with **no Nx and no Nx workspace**. Requiring Nx would defeat a vendor-neutral microfrontend solution.
2. **Nx is an internal tool, never a consumer prerequisite.** Nx generators/executors, if wanted, live in a separate opt-in package (see [07](07-nx-adapter.md)). The core package must never depend on it.
3. **"Plugin" has a new meaning.** A "plugin" is now an **opt-in extension a consumer adds** (experience plugins, display-mode plugins, the Nx adapter) — _not_ an Nx plugin. `@hyperfrontend/features` itself is a package, not a plugin.
4. **Same package, converted identity.** The project already exists as `@hyperfrontend/features` at `plugins/features/`. We relocate and reframe it (preserving git history and the publish-ready README); we do **not** create a second package or change its name.
5. **Bundled deps stay in `dependencies`.** Direct deps are declared in `dependencies` (never `devDependencies`) and bundled by `@hyperfrontend/builder`'s dedupe/prune pass. Bundled `.d.ts` must be self-contained — no transitive install burden pushed onto consumers (typescript is the lone exception).
6. **CLI/bin must actually execute.** Shipping `npx @hyperfrontend/features` requires the builder-produced bin to resolve under npm, pnpm, Yarn, and Nx. This is gated by [02](02-cli-bin-execution.md).
7. **Consume the published building blocks; never reimplement.** See the table below. In particular, never touch `node:fs` directly — use `@hyperfrontend/project-scope`.
8. **Don't hand-roll what a generator/skill produces.** Use the `@hyperfrontend/package` generators and the matching skills for structural work (see [01](01-reposition-and-publishability.md)).
9. **Know the conventions before writing code, and gate every plan before calling it done.** Before generating any source for any plan in this family, read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) — those conventions (no enums, no direct built-in calls, import/export order, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests) are lint-enforced and fail CI, so fix them preemptively. After a plan's initial code changes land, run the cache-busted gate as the final review/polish pass and do **not** mark the plan complete until all four pass clean (substitute the project the plan builds — `lib-features` for 01–06):

   ```bash
   npx nx typecheck lib-features --skip-nx-cache
   npx nx lint lib-features --skip-nx-cache
   npx nx test lib-features --skip-nx-cache
   npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
   ```

10. **Don't author docs or architecture ahead of the code they describe.** ARCHITECTURE.md, API docs, and `@example` blocks can only be written once the system they document exists — leave them as stubs (or delegated to the relevant later phase) rather than documenting a system whose code does not exist yet.

### Available building blocks (shared reference)

Every runtime and tooling dependency `@hyperfrontend/features` needs is already published and consumable today. Build directly on top of them — declare in `dependencies` and let the builder's dedupe/prune pass bundle them. See `LIBRARY_COMPATIBILITY.md` for current versions.

| Dependency                        | Used By          | Purpose                | What to consume                                                                                                                                                                                                       |
| --------------------------------- | ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hyperfrontend/nexus`            | SDK              | Messaging layer        | Consume the broker API rather than reimplementing channels.                                                                                                                                                           |
| `@hyperfrontend/network-protocol` | SDK              | Security/encryption    | Consume for the `none`/`v1`/`v2` security envelope.                                                                                                                                                                   |
| `@hyperfrontend/versioning`       | Shell generation | Version management     | Prefer for shell/contract version stamping and compatibility.                                                                                                                                                         |
| `@hyperfrontend/project-scope`    | CLI/generators   | Project file I/O       | Consume for **all** filesystem/workspace I/O; never touch `node:fs` directly.                                                                                                                                         |
| `@hyperfrontend/json-utils`       | Config parsing   | JSON Schema validation | Validation-only (Draft-4 `validate`/`createValidator`); it has **no** parse/stringify or schema→type. **Reading** JSON is `project-scope` `readJsonFile`; **stringify** is `immutable-api-utils` (`libs/utils/json`). |
| `@hyperfrontend/questions`        | CLI              | Interactive prompts    | Consume rather than adding a third-party prompt lib.                                                                                                                                                                  |
| `@hyperfrontend/builder`          | Build/bin        | Bundling + JS bins     | Consume for building the package and synthesizing the CLI bin (`/bundle`, `/bin/script`, `/package`).                                                                                                                 |

---

## Cross-cutting concerns to keep visible from the start

- **Package publishability** — the publishability checklist in [01](01-reposition-and-publishability.md) gates real SDK work; every subpath export, bundled dep, and `.d.ts` must satisfy it.
- **Nx as internal tool only** — threaded through [01](01-reposition-and-publishability.md) and [07](07-nx-adapter.md); also drives the docs reclassification in [11](11-docs-cleanup.md).
- **CLI/bin execution** — [02](02-cli-bin-execution.md) gates [05](05-cli.md)'s published CLI.
- **Migration of the existing `plugin` project** — [01](01-reposition-and-publishability.md) is the single source of truth; salvaged design intent flows into [05](05-cli.md) (CLI) and [06](06-dev-server.md) (dev server).
- **Builder/package conventions** — bundled deps, subpath exports, ESM/CJS output, `bin` synthesis; see [01](01-reposition-and-publishability.md) and the building-blocks table above.
- **Testing & E2E** — unit coverage meets the lib coverage gate; the generated E2E project asserts the packed package imports cleanly in every declared format and that the CLI bin executes under `npx`/`pnpm dlx`.
- **Docs-site / API documentation** — new `libs/features/` paths replace stale `plugins/features` references; the package/CLI reclassification landed (was plan 11, now done). Remaining docs-site work is demo integration — see [09](09-docs-site-integration.md).

---

## Deferred items (cross-cutting future work)

Explicitly deferred to future work — captured here so they stay visible, not scheduled now:

| Item                                 | Reason                                                                                                                                                                                                                                                                             | Priority |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Emit debug-UI assets in the build    | The `./server` build does not bundle `src/server/debug-ui/{index.html,bootstrap.ts,…}` beside the compiled server, so a published `dev` server cannot serve the debug UI without an injected `assetRoot`. Needs an assets/iife build pass (carried over from the removed 06 plan). | Medium   |
| Version negotiation at runtime       | Need more design                                                                                                                                                                                                                                                                   | Medium   |
| Auto-retry on errors                 | Keep v1 simple                                                                                                                                                                                                                                                                     | Low      |
| Experience plugins                   | Future extensibility                                                                                                                                                                                                                                                               | Low      |
| Framework-specific adapters          | Leave room, don't build                                                                                                                                                                                                                                                            | Low      |
| Web Component alternative to iframes | Experimental (55% confidence)                                                                                                                                                                                                                                                      | Low      |

The Nx adapter (was plan 07) and Documentation Cleanup (was plan 11) have both landed; their plan files are removed. The remaining active plans are demos (08), docs-site integration (09), and deployment (10).
