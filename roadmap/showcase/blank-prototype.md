# The blank prototype (feature-only variant)

**Extracted from** Demo 1 (plan 04 — delivered, Phase 7) — documented against what was **actually built**, not what was planned. This is the seed for the demo generator ([06](06-demo-2-and-generator.md)): the shape every feature-only demo starts from, with the clock-specific flesh stripped away.

## Vital components

A feature-only demo slot is **one self-contained consumer app** at `apps/demos/<name>/` (project `demo-<name>`), hosted by the docs-site gallery. Its skeleton:

| Piece                | File(s)                                                                                                                                                  | Notes for the generator                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold             | `create-vue` (or per-framework equivalent) with `--ts --vitest --eslint --bare`                                                                          | Scaffold-native tsconfig **must not** extend the workspace base (invariant #1: the workspace maps `@hyperfrontend/features` to `libs/`)                           |
| SDK dependency       | `npm i @hyperfrontend/features@<published>` + committed `package-lock.json`                                                                              | `node_modules` gitignored; lockfile committed (docs-site house pattern)                                                                                           |
| Contract             | `<name>.contract.ts` at the project root, default-exporting a `FeatureContract` (`satisfies` for typing)                                                 | `FeatureContract` type imports from the package **root**, not `/hostee` (0.1.0 does not export it there)                                                          |
| Config               | `feature.config.ts` via `defineConfig` (delete the JSON one `hf init` writes — discovery prefers JSON)                                                   | Code-first by design direction                                                                                                                                    |
| Glue                 | `src/hyperfrontend.feature.ts` from `hf init`, then hand-fixed                                                                                           | Fix the contract import path and the untyped stubs `hf init` emits                                                                                                |
| Wiring               | `src/feature/wire-contract.ts` — a DI factory `wire<Name>Contract(featureLink, store)`                                                                   | Keeps action handlers unit-testable without a live channel; the glue file stays 3 lines                                                                           |
| State                | `src/state/<name>-store.ts` — one reactive store owning all feature state                                                                                | The contract mutates the store; the UI renders it; echo events subscribe to it                                                                                    |
| Dev loop             | `scripts/hf-dev.ts` + `dev-host/` (index.html, bootstrap.js)                                                                                             | Mandatory on SDK v0.1.0: works around the dev-server exit, asset self-location, missing debug UI, and isolation crash; delete when the SDK debug UI ships         |
| Shell build          | `@hyperfrontend/app:pack-shell` executor → `dist/apps/demos/<name>/shell/<pkg>-shell-<v>.tgz`                                                            | Workspace-generalized workaround for `hf build` failing on its own connector; drives the SDK's generator from the app's `node_modules`, compiles with plain `tsc` |
| Outputs              | App bundle → `dist/apps/demos/<name>/app/` (vite `outDir`); shell tarball → `dist/apps/demos/<name>/shell/`                                              | Apps mirror the lib convention: everything under the workspace `dist/` tree at the project's source path                                                          |
| Nx targets           | `project.json`: `install`/`dev`/`build`/`pack-shell` (via `@hyperfrontend/app` executors), `test`/`lint`/`typecheck` (run-commands wrapping npm scripts) | Tags `["type:demo", "role:feature", "scope:standalone"]`; deploy metadata under `metadata.deploy`                                                                 |
| Gallery registration | Entry in `apps/docs-site/src/lib/demo-manifest.ts` + poster in `public/demos/` + vendored tarball (`file:` dep) + `refresh-shell` flow                   | Poster is committed (Vercel builds standalone); docs-site lists the demo in `implicitDependencies`; only the centered card mounts live                            |
| Deploy metadata      | `project.json` → `metadata.deploy` (`provider`, `service`, `origin`, `boundary`, `kind`, `publishDir`)                                                   | Railway static service per origin; `publishDir` points into the workspace dist tree, so the service builds from the repo root                                     |

## The right level of emptiness

- **Keep**: everything in the table above, with a one-action contract (`ping`/`pong` or similar) proving the loop, one trivial store field, and an empty `App.vue` stage. The wiring factory + fake-feature test harness (`createFakeFeature()` from the clock's `wire-contract.spec.ts`) carry over verbatim — that pattern is contract-agnostic.
- **Strip**: all clock flesh — physics, faces, alarms, `Intl` time math. Demo-specific by definition.
- **Undecided until demo 2**: whether `dev-host/bootstrap.js` should read the accepted/emitted action lists from the contract (via a tiny build step) instead of hardcoding them; the clock hardcodes.

## Pre-built content the prototype must ship

1. The **F-workarounds as first-class pieces** (`scripts/hf-dev.ts`, `dev-host/`, the workspace `pack-shell` executor, the `SharedArrayBuffer` stub on every host surface) — on SDK v0.1.0 a demo without them does not run. Each carries a comment naming its finding so they can be deleted the day the finding is fixed.
2. The **host-oriented contract swap**: on 0.1.0, any host surface that sends commands needs the emitted/accepted mirror of the feature contract.
3. An **axe smoke test** and the vitest setup (`src/__tests__/a11y.spec.ts` shape).
4. A README with the topology/origins table and the "known SDK limitations" section.

## Not in this variant

Demo-owned hosts (stock dashboard, views, chess…) are the second prototype variant, extracted when the first demo needs one. The `@hyperfrontend/features/nx/*` generator/executor surface is untouched (needs an Nx-workspace consumer demo). Security protocols are `'none'` throughout (labeled; the envelope story belongs to the security demo).
