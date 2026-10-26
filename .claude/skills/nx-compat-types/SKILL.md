---
name: nx-compat-types
description: Regenerate, check and extend the @nx/devkit-compatible declarations in libs/integrations/nx/src/compat, generated from Nx's sources by the types-extract tool in tools/workspace. Use when bumping nx or @nx/devkit, when types-extract-check fails, when an executor needs an Nx type the compat entry lacks, when REPORT.md shows a new substitution, or when a typecheck error names compat/, model.compat.spec.ts or compat.spec.ts.
---

# Nx compat types

Generated files. **Never edit by hand**; change the config and regenerate. The compat entry outlives Nx in this repo: after M11 of `roadmap/nx-uncoupling.md` nothing Nx is installed at the root, and `compat` is the contract the published features plugin and the owned task runner are written against.

## Paths

| Role                             | Where                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- |
| Requests, depth, overrides, ref  | `tools/workspace/types-extract.config.ts`                                  |
| Locked commit per source         | `tools/workspace/types-extract.lock.json`                                  |
| Engine                           | `tools/workspace/src/types-extract/*.ts` (specs beside each file)          |
| CLI                              | `tools/workspace/bin/types-extract.ts` (`--check`, `--update`)             |
| Generated declarations           | `libs/integrations/nx/src/compat/{executor,graph,tree,plugin}.ts`          |
| Generated barrel, report, notice | `libs/integrations/nx/src/compat/{index.ts,REPORT.md,NOTICE.md}`           |
| Drift probe against real devkit  | `libs/integrations/nx/src/compat/compat.spec.ts` (e2e `nx` lane after M11) |
| Features' hand-mirrored subset   | `libs/features/src/nx/model.ts` + `model.compat.spec.ts` (kept)            |
| Consumers                        | `tools/{app,package,workspace}/src/executors/**`, version `lib/*`          |

## Gate

Before editing anything under `compat/`: **STOP**, edit the config instead.
Before bumping `nx`/`@nx/devkit` in `package.json` (until M11 removes them): set `sources.nx.ref` to the same tag in the config. After M11 the `ref` is the only Nx version the repo holds.
Before adding `@nx/devkit` to a file: import the type from `@hyperfrontend/integration-nx/compat`; a missing name is a new root or a deeper request, not a devkit import.

## Patterns

Regenerate (resolves the ref once, writes the lock, writes only changed files):

```bash
npx nx run tool-workspace:types-extract
```

Verify, byte-exact, twice for determinism:

```bash
npx nx run tool-workspace:types-extract-check
```

Bump Nx:

```bash
# 1. tools/workspace/types-extract.config.ts: ref: '23.4.0'
# 2. until M11 only: package.json nx + @nx/devkit → 23.4.0 ; npm install
npx nx run tool-workspace:types-extract
git diff --stat libs/integrations/nx/src/compat   # read REPORT.md rows that appeared or vanished
npx nx run-many -t typecheck,test --projects=lib-integration-nx,tool-app,tool-package,tool-workspace,lib-features
```

Add a type an executor needs:

```ts
// tools/workspace/types-extract.config.ts → requests[]
{ source: 'nx', root: 'packages/nx/src/config/misc-interfaces.ts', symbols: ['ExecutorContext', 'TaskGraphExecutor'], depth: 2, output: 'libs/integrations/nx/src/compat/executor.ts' }
```

Stop carrying a heavy or churning declaration (every reference to it becomes the text; `Pick`/`Omit`/`keyof`/indexed access of it become `unknown`):

```ts
overrides: {
  NxReleaseConfiguration: 'object'
}
```

Move a branch ref (tags never move):

```bash
node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/types-extract.ts --update
```

## Rules the engine applies

- Roots emit in full; references are followed `depth` deep; past it → `unknown`, listed in `REPORT.md` as `beyond-depth`.
- A root lands in its own request's output; anything else in the first request that reached it.
- `any` → `unknown`; untyped parameter → `: unknown`; enum → union of literals; class → interface of public instance members; namespace member → `Ns_Member`; `typeof` and import types → `unknown`; Node built-ins stay imports; globals stay.
- Override replacement must be a supertype of upstream (use `object`, never `Record<string, unknown>`: interfaces lack index signatures) so `compat.spec.ts` keeps devkit → compat assignable.
- `include` prefixes end with `/`; a module outside them is a boundary.

## Gotchas

- `lint:all` runs `--fix`; `compat/*.ts` and the markdown are lint-ignored, the barrel is linted and prettier-ignored, so the emitter writes what the fixers want (sorted specifiers, no bare `@scope` in JSDoc). A check failing right after `lint:all` means a fixer touched a generated file: regenerate, then fix the emitter.
- `--check` compares against the **locked** commit; it does not notice a newer Nx. The drift signal for an unregenerated bump is `compat.spec.ts` failing typecheck (M11 moves that probe into the features e2e `nx` lane, the one place a real devkit is installed).
- The GitHub API resolves the ref once; `GITHUB_TOKEN` lifts the anonymous rate limit. Raw file reads need no token.
- `@nx/devkit` stays installed until M11: `version-batch` calls `createProjectGraphAsync` (gone in M4), `tools/package` generators use the devkit tree helpers (gone in M9), the two compat specs import its types (moved in M11). Never add a new devkit import.
- Folding `compat` into `libs/features` failed: `nx/*` entries emit per-file `.d.ts`, so the bare import survives. Do not retry until the builder bundles those declarations.

## Checklist

- [ ] Config edited, not `compat/`
- [ ] `types-extract` run, `types-extract-check` green twice
- [ ] `REPORT.md` diff read; every new substitution intended
- [ ] `ref` matches the installed `nx`/`@nx/devkit` while they exist (until M11)
- [ ] Typecheck green: `lib-integration-nx`, `tool-app`, `tool-package`, `tool-workspace`, `lib-features`
