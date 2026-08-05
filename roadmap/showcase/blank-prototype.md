# The blank prototype (feature-only variant)

The shape every feature-only demo starts from, with the demo-specific flesh stripped away — documented against the current clock/heartbeat consumer shape on `@hyperfrontend/features` 0.5.x. This is the seed for the demo generator ([06](06-demo-2-and-generator.md)).

## Vital components

A feature-only demo slot is **one self-contained consumer app** at `apps/demos/<name>/` (project `demo-<name>`), hosted by the docs-site gallery. Its skeleton:

| Piece                | File(s)                                                                                                                                                                  | Notes for the generator                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold             | `create-vue` (or per-framework equivalent) with `--ts --vitest --eslint --bare`                                                                                          | Scaffold-native tsconfig **must not** extend the workspace base (invariant #1: the workspace maps `@hyperfrontend/features` to `libs/`)                       |
| SDK dependency       | `npm i @hyperfrontend/features@<published>` + committed `package-lock.json`                                                                                              | `node_modules` gitignored; lockfile committed (docs-site house pattern)                                                                                       |
| Contract             | `<name>.contract.ts` at the project root, default-exporting a `FeatureContract` (`satisfies` for typing)                                                                 | `FeatureContract` type imports from `@hyperfrontend/features/hostee`                                                                                          |
| Config               | `feature.config.ts` via `defineConfig`, declaring `protocol: 'v1'` and the demo's display modes                                                                          | Code-first by design direction                                                                                                                                |
| Glue                 | `src/hyperfrontend.feature.ts` from `hf init`                                                                                                                            | Stays ~3 lines; delegates to the wiring factory                                                                                                               |
| Wiring               | `src/feature/wire-contract.ts` — a DI factory `wire<Name>Contract(featureLink, store)`                                                                                   | Keeps action handlers unit-testable without a live channel                                                                                                    |
| State                | `src/state/<name>-store.ts` — one reactive store owning all feature state                                                                                                | The contract mutates the store; the UI renders it; echo events subscribe to it                                                                                |
| Dev loop             | `hf-dev.config.ts` via `defineDevConfig` (pinned port per demo; clock=4280, heartbeat=4281) + `hf:dev` / `dev:hosted` npm scripts (`vite build --watch` ∥ `hf dev`)      | Port is pinned so the docs-site `.env.development` embed wiring can find it                                                                                   |
| Shell build          | `pack-shell` Nx target → `npx hf build --ci --out ../../../dist/apps/demos/<name>/shell`                                                                                 | Produces the self-contained shell tarball `dist/apps/demos/<name>/shell/<pkg>-shell-<v>.tgz`                                                                  |
| Outputs              | App bundle → `dist/apps/demos/<name>/app/` (vite `outDir`); shell tarball → `dist/apps/demos/<name>/shell/`                                                              | Apps mirror the lib convention: everything under the workspace `dist/` tree at the project's source path                                                      |
| Nx targets           | `project.json`: `install`/`dev`/`build` (via `@hyperfrontend/app` executors), `test`/`lint`/`typecheck` (run-commands wrapping npm scripts), `pack-shell` (run-commands) | Tags `["type:demo", "role:feature", "scope:standalone"]`; deploy metadata under `metadata.deploy`                                                             |
| Gallery registration | Entry in `apps/docs-site/src/lib/demo-manifest.ts` + vendored tarball (`file:` dep) + `refresh-shell` flow                                                               | docs-site lists the demo in `implicitDependencies` and the shell's exact package name in `ignoredDependencies`; the fallback card renders until proof of life |
| Deploy metadata      | `project.json` → `metadata.deploy` (`provider`, `service`, `origin`, `boundary`, `kind`, `publishDir`)                                                                   | Railway service per origin, configured in the Railway dashboard; deploys ride the GitHub integration on merge to `main`                                       |

## The right level of emptiness

- **Keep**: everything in the table above, with a one-action contract (`ping`/`pong` or similar) proving the loop, one trivial store field, and an empty stage component. The wiring factory + fake-feature test harness (`createFakeFeature()` from the clock's `wire-contract.spec.ts`) carry over verbatim — that pattern is contract-agnostic.
- **Strip**: all demo flesh — physics, faces, rhythm engines, domain state. Demo-specific by definition.

## Pre-built content the prototype must ship

1. The **wiring factory + fake-feature vitest harness** (unit tests pass out of the box).
2. A README with the topology/origins table.

## Not in this variant

Demo-owned hosts are the second prototype variant. Heartbeat became the first demo-owned-host case (a second same-origin page in the same Vite app: `host/index.html` + `src/host/`); **that variant is still to be extracted from heartbeat** before the generator can cover host-bearing demos. The `@hyperfrontend/features/nx/*` generator/executor surface is untouched (needs an Nx-workspace consumer demo). Security protocol `'v1'` is the demo default; the v2 pre-shared-key story belongs to the security demo.
