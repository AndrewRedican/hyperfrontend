---
name: nx-compat-types
description: Regenerate, check and extend the @nx/devkit-compatible declarations in libs/integrations/nx/src/compat, generated from Nx's sources by the types-extract tool in tools/workspace. Use when bumping nx or @nx/devkit, when types-extract-check fails, when an executor needs an Nx type the compat entry lacks, when REPORT.md shows a new substitution, when a typecheck error names compat/, or when the features e2e nx lane's nx-types spec fails.
---

# Nx compat types

Generated files. **Never edit by hand**; change the config and regenerate. Nothing Nx is installed at the root: `compat` is the contract the workspace's executors and the owned task runner are written against, and the `ref` in the config, with the e2e lane's `NX_VERSION`, are the only Nx versions the repo holds.

## Paths

| Role                             | Where                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Requests, depth, overrides, ref  | `tools/workspace/types-extract.config.ts`                                                               |
| Locked commit per source         | `tools/workspace/types-extract.lock.json`                                                               |
| Engine                           | `tools/workspace/src/types-extract/*.ts` (specs beside each file)                                       |
| CLI                              | `tools/workspace/bin/types-extract.ts` (`--check`, `--update`)                                          |
| Generated declarations           | `libs/integrations/nx/src/compat/{executor,graph,tree,plugin}.ts`                                       |
| Generated barrel, report, notice | `libs/integrations/nx/src/compat/{index.ts,REPORT.md,NOTICE.md}`                                        |
| Drift probe against real devkit  | `apps/package-e2e/features/src/nx-types.spec.ts` + `src/support/nx-types-probe.ts` (e2e `nx` lane)      |
| Features' hand-mirrored subset   | `libs/features/src/nx/model.ts`, probed through the published generators and executors in the same lane |
| Consumers                        | `tools/{app,package,workspace}/src/executors/**`, version `lib/*`                                       |

## Gate

Before editing anything under `compat/`: **STOP**, edit the config instead.
Before changing the Nx version: `sources.nx.ref` in the config is it, and `NX_VERSION` in `apps/package-e2e/features/src/support/nx-workspace.ts` (the `create-nx-workspace` the e2e lane installs) is the same tag.
Before adding `@nx/devkit` to a file: import the type from `@hyperfrontend/integration-nx/compat`; a missing name is a new root or a deeper request, not a devkit import.

## Patterns

Regenerate (resolves the ref once, writes the lock, writes only changed files):

```bash
npm run hf -- run tool-workspace:types-extract
```

Verify, byte-exact, twice for determinism:

```bash
npm run hf -- run tool-workspace:types-extract-check
```

Bump Nx:

```bash
# 1. tools/workspace/types-extract.config.ts: ref: '23.4.0'
# 2. the e2e lane's NX_VERSION is the same tag
npm run hf -- run tool-workspace:types-extract
git diff --stat libs/integrations/nx/src/compat   # read REPORT.md rows that appeared or vanished
npm run hf -- run-many -t typecheck,test \
  -p lib-integration-nx,tool-app,tool-package,tool-workspace,lib-features
# the nx lane probes against the real devkit
CI=1 npm run hf -- run-many -t e2e -p e2e-lib-features
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
- Override replacement must be a supertype of upstream (use `object`, never `Record<string, unknown>`: interfaces lack index signatures) so the e2e lane's nx-types probe keeps devkit → compat assignable.
- `include` prefixes end with `/`; a module outside them is a boundary.

## Gotchas

- `lint:all` runs `--fix`; `compat/*.ts` and the markdown are lint-ignored, the barrel is linted and prettier-ignored, so the emitter writes what the fixers want (sorted specifiers, no bare `@scope` in JSDoc). A check failing right after `lint:all` means a fixer touched a generated file: regenerate, then fix the emitter.
- `--check` compares against the **locked** commit; it does not notice a newer Nx. The drift signal for an unregenerated bump is the nx-types spec of the features e2e `nx` lane failing: it copies the generated declarations into the consumer workspace `create-nx-workspace` made, the one place a real devkit is installed, and runs that workspace's `tsc` over assignments against its `@nx/devkit` and the published features generators and executors.
- The GitHub API resolves the ref once; `GITHUB_TOKEN` lifts the anonymous rate limit. Raw file reads need no token.
- `@nx/devkit` is not installed at the root, so a devkit import anywhere in the workspace fails to resolve. Never add one; the e2e lane is the only code that reads the real devkit.
- Folding `compat` into `libs/features` failed: `nx/*` entries emit per-file `.d.ts`, so the bare import survives. Do not retry until the builder bundles those declarations.

## Checklist

- [ ] Config edited, not `compat/`
- [ ] `types-extract` run, `types-extract-check` green twice
- [ ] `REPORT.md` diff read; every new substitution intended
- [ ] `ref` and the e2e lane's `NX_VERSION` name the same tag; the `nx` lane of `e2e-lib-features` green
- [ ] Typecheck green: `lib-integration-nx`, `tool-app`, `tool-package`, `tool-workspace`, `lib-features`
