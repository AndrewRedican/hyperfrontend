# 01 — Reposition & Publishability

**Foundation. Do this first.** Move the existing `@hyperfrontend/features` project out of `plugins/`, drop its Nx-plugin identity, and promote it to a publishable, vendor-agnostic package — _before_ any SDK code is written.

See the [index](README.md) for the full plan family and shared invariants. The invariants this plan establishes (vendor-agnostic, Nx-internal-only, same-package-converted, "plugin" redefined) hold across every downstream plan.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first**. Every convention there — no enums (use `freeze(<const>{…})`), no direct built-in calls (use `@hyperfrontend/immutable-api-utils`), import/export ordering, required JSDoc on exported members, categorized comment prefixes, file-size limits, and assertive one-assertion-per-test specs — is lint-enforced and fails CI. Fix violations preemptively rather than after the fact (shared invariant 9).

> **Don't author docs or architecture ahead of the code they describe (shared invariant 10).** This plan only relocates and promotes the package; the SDK source does not exist yet. Leave `ARCHITECTURE.md`, the API/`@example` docs, and the deeper README sections as stubs until the systems they describe are built ([03 — Core SDK](03-core-sdk.md) through [06 — Dev Server](06-dev-server.md)). Documenting a system whose code does not exist yet is out of scope here.

---

## Why this comes first

The project we are building **already exists**: it is the `@hyperfrontend/features` project at `plugins/features/` (Nx project `plugin-features`, `private: true`, `0.0.0`). This is the same package — we are **not** creating a second one and we are **not** changing its name. What changes is its identity: today it is positioned as an `@nx/devkit` plugin (init/add generators, serve executor — still implementation-stub comments); going forward it is a **vendor-agnostic, publishable package** (host/hostee SDK + shell generator + CLI + dev server) that consumers can use with no Nx and no Nx workspace. Requiring Nx would defeat the purpose of a micro-frontend solution that must stay vendor-neutral.

> **Terminology change (applies across the whole plan family).** "Plugin(s)" no longer means "Nx plugin" here. From now on, **plugins are opt-in extensions that consumers of `@hyperfrontend/features` choose to add** (experience plugins, display-mode plugins, framework/Nx adapters). `@hyperfrontend/features` itself is a package, not a plugin, and must move out of the `plugins/` tree and out of every "Plugins" menu (see [11 — Documentation Cleanup](11-docs-cleanup.md)).

---

## Target package structure

This is the shape the relocated package builds toward. Downstream plans (03–06) populate the `src/` subtrees.

```
libs/features/
├── package.json
│   {
│     "name": "@hyperfrontend/features",
│     "version": "0.1.0",
│     "exports": {
│       ".": "./dist/index.js",
│       "./host": "./dist/sdk/host/index.js",
│       "./hostee": "./dist/sdk/hostee/index.js",
│       "./cli": "./dist/cli/index.js",
│       "./server": "./dist/server/index.js"
│     },
│     "bin": {
│       "hf": "./dist/cli/bin.js"
│     },
│     "dependencies": {
│       "@hyperfrontend/nexus": "...",
│       "@hyperfrontend/network-protocol": "...",
│       "@hyperfrontend/versioning": "...",
│       "@hyperfrontend/project-scope": "...",
│       "@hyperfrontend/json-utils": "..."
│     }
│   }
│
├── src/
│   ├── index.ts                     # Main entry (re-exports)
│   │
│   ├── sdk/
│   │   ├── host/                    # Host-side SDK            → see 03
│   │   │   ├── create-shell.ts      # Factory for shell instances
│   │   │   ├── display-modes/
│   │   │   │   ├── embedded.ts      # Inline in container
│   │   │   │   ├── dialog.ts        # Modal with overlay
│   │   │   │   ├── popup.ts         # New browser window
│   │   │   │   ├── standalone.ts    # Full page
│   │   │   │   └── index.ts
│   │   │   ├── lifecycle.ts         # Open/close/destroy state machine
│   │   │   ├── iframe.ts            # Iframe creation utilities
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── hostee/                  # Hostee-side SDK          → see 03
│   │   │   ├── create-feature.ts    # Feature initialization
│   │   │   ├── lifecycle.ts         # Feature lifecycle
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── shared/                  # Shared types, utilities  → see 03
│   │       ├── types.ts             # Common interfaces
│   │       ├── contract.ts          # Contract utilities
│   │       └── index.ts
│   │
│   ├── cli/                          # → see 05
│   │   ├── bin.ts                   # CLI entry point
│   │   ├── commands/
│   │   │   ├── init.ts              # Initialize feature or shell
│   │   │   ├── build.ts             # Build shell package
│   │   │   ├── dev.ts               # Start dev server
│   │   │   └── index.ts
│   │   ├── prompts.ts               # Interactive prompts (uses @hyperfrontend/questions)
│   │   └── index.ts
│   │
│   ├── server/                       # → see 06
│   │   ├── dev-server.ts            # Static file server
│   │   ├── debug-ui/                # Debug interface
│   │   │   ├── index.html           # Debug page template
│   │   │   ├── controls.ts          # Display mode, resize controls
│   │   │   ├── message-log.ts       # Message traffic viewer
│   │   │   └── styles.ts            # Inline styles (no CSS files)
│   │   ├── config.ts                # Config file parsing
│   │   └── index.ts
│   │
│   ├── generators/                  # Code generation         → see 04
│   │   ├── shell/
│   │   │   ├── templates/           # Shell code templates
│   │   │   │   ├── shell.core.ts.template
│   │   │   │   ├── shell.config.ts.template
│   │   │   │   └── shell.exports.ts.template
│   │   │   └── generate-shell.ts
│   │   ├── contract/
│   │   │   └── generate-types.ts    # Generate TS types from contract
│   │   ├── metadata/
│   │   │   └── generate-metadata.ts # Generate metadata.json
│   │   └── index.ts
│   │                                # NOTE: no @nx/devkit, no generators.json /
│   │                                # executors.json here — the core package is
│   │                                # vendor-agnostic. Nx support is a separate
│   │                                # opt-in package (see 07).
│
├── README.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

---

## Scaffolding & automation (use generators, don't hand-roll)

Do not hand-roll project files that an existing generator or skill already produces. The repo's `@hyperfrontend/package` generators (all support `--dry-run`) and the matching Claude skills cover most of the structural work.

| Need                                               | Use this                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Relocate the project `plugins/` -> `libs/`         | `nx generate @hyperfrontend/package:move` (updates all references)                                   |
| Rename project `plugin-features` -> `features`     | `nx generate @hyperfrontend/package:rename`                                                          |
| Promote the relocated project to publishable       | `nx generate @hyperfrontend/package:make-publishable` (creates the E2E project + CI status workflow) |
| Scaffold a brand-new lib (opt-in adapter)          | `nx generate @hyperfrontend/package:library --publishable` (see the `library-generators` skill)      |
| package.json / project.json fields & entry points  | `library-package-config` skill                                                                       |
| Public exports, subpath exports, build targets     | `library-package-config` skill                                                                       |
| ESM/CJS/IIFE/UMD output verification + E2E project | `library-e2e-setup` skill                                                                            |
| CI path filters + library workflow                 | `library-ci-workflows` skill                                                                         |
| README / sub-module docs                           | `readme-docs` skill                                                                                  |
| ARCHITECTURE.md                                    | `architecture-docs` skill                                                                            |
| Coding conventions for any new source              | `coding` skill                                                                                       |

> `make-publishable` leaves **6 manual entries** (root README table, `ci-libraries.yml`, `ci-main.yml`, and three docs-site files). Budget for those — they are listed in the `library-generators` skill and are easy to miss.

---

## Phase 2.0 — Reposition the existing project (out of `plugins/`, into a vendor-agnostic package)

**Chosen approach — relocate and reframe the same project, don't greenfield:**

1. **Move it into `libs/` and drop the Nx-plugin identity.** Use `nx generate @hyperfrontend/package:move --project=plugin-features --destination=libs/features` to relocate `plugins/features/` → `libs/features/` (the generator updates all references), then rename the Nx project to `lib-features` (repo convention: project names are prefixed `lib-`, even though the published package stays `@hyperfrontend/features`) with `nx generate @hyperfrontend/package:rename --project=plugin-features --newName=lib-features`. Remove the `@nx/devkit` dependency, `generators.json`/`executors.json`, and the `generators`/`executors` package.json keys from the core package — the package no longer registers itself as an Nx plugin. This preserves the project's git history and its publish-ready README instead of discarding it.
2. **Promote to publishable** with `nx generate @hyperfrontend/package:make-publishable --project=lib-features`, then complete the publishability checklist (Phase 2.1).
3. **Salvage the design intent** captured in the old init/add/serve stub comments (feature.config.json shape, contracts layout, dev playground) by folding it into the SDK's CLI ([05](05-cli.md)) and dev server ([06](06-dev-server.md)) — these are now plain APIs/commands, not Nx generators.
4. **Optional Nx adapter is opt-in only.** If Nx generators/executors are still wanted, they live as a separate, optional opt-in package — one of the new-sense "plugins" — that delegates to this SDK ([07](07-nx-adapter.md)). The core package never depends on it.

This keeps the same package and name, preserves history, and converts identity rather than rewriting — while making vendor-agnostic the default and Nx strictly optional.

---

## Phase 2.1 — Promote to a publishable package

The project already has its config files (moved in Phase 2.0). Promote it rather than re-authoring by hand:

```bash
nx generate @hyperfrontend/package:make-publishable --project=lib-features
```

This adds the E2E project + CI status workflow and the publishable build target (plus the 6 manual entries noted above). Then apply the **publishability checklist** below before writing SDK code.

**Publishability checklist (repo conventions):**

- **Name & metadata:** package name `@hyperfrontend/features`, non-private, `license`, `description`, `funding`, `keywords`, `engines` — match the shape of `libs/builder/package.json`.
- **Exports & subpaths:** declare `.`, `./host`, `./hostee`, `./cli`, `./server` subpath exports; configure them via the `library-package-config` skill (do not hand-edit blindly — it has ESLint rules that enforce required fields).
- **CLI/bin:** declare the bin in the build config so `@hyperfrontend/builder` synthesizes the `bin` field, shebang, and `0o755` output. **Gate on the [CLI/bin research](02-cli-bin-execution.md).**
- **TypeScript declarations:** ensure `.d.ts` emission per entry point; bundled-dep declarations must be self-contained (no transitive install burden pushed onto consumers).
- **ESM/CJS output:** emit both ESM and CJS via the builder; declare formats per entry point and verify with the `library-e2e-setup` skill (ESM, CJS, IIFE/UMD where relevant).
- **Docs:** README via `readme-docs`, ARCHITECTURE.md via `architecture-docs`, `@example` blocks via `jsdoc-examples`. **Defer the SDK-specific sections** until the corresponding code lands ([03](03-core-sdk.md)–[06](06-dev-server.md)) — do not document a system that does not exist yet (shared invariant 10); at this stage only the package-level shell of these docs is in scope.
- **Tests & E2E:** unit coverage meets the lib coverage gate; the generated E2E project asserts the packed package imports cleanly in every declared format and that the CLI bin executes under `npx`/`pnpm dlx`.
- **Build & boundary checks:** `nx build lib-features` clean; verify Nx project boundaries/tags (no consumer-facing dep on `@hyperfrontend/features-nx`); run the dependency review so only intended packages land in `dependencies`.
- **Publish inspection:** `npm pack --dry-run` (or `nx run lib-features:build` + inspect the output `package.json`/tarball) to confirm `files`, `exports`, `bin`, and bundled deps are exactly as intended before any real publish.

---

## Core decisions established here

These cross-cutting decisions are set by this plan and inherited everywhere else.

| #   | Topic              | Decision                                                                                                            |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Location           | `libs/features/` (publishable library, not plugin)                                                                  |
| 2   | Entry points       | Sub-path exports: `/host`, `/hostee`, `/cli`, `/server`                                                             |
| 3   | CLI invocation     | `npx @hyperfrontend/features <command>`                                                                             |
| 4   | Bundling           | Direct deps (nexus, network-protocol, versioning) bundled                                                           |
| 5   | Framework adapters | None for now (leave room for future)                                                                                |
| 6   | Nx exclusivity     | Consumers do NOT need Nx; Nx stays an internal/optional-adapter concern. Use `@hyperfrontend/project-scope` for I/O |

---

## Verification

Iterative checks while repositioning:

```bash
npx nx build lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

Plus the publish inspection (`npm pack --dry-run`) from the checklist above.

### Final review (before marking this plan complete)

After the initial changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- The exact set of `make-publishable` manual entries should be re-verified against the current `library-generators` skill before executing (line numbers and file lists drift).
