# F-002 — `hf build` crashes in a fresh project: TypeScript plugin cannot find `tslib`

| Field        | Value                       |
| ------------ | --------------------------- |
| Category     | packaging                   |
| Severity     | blocker                     |
| Surfaced by  | demo-clock 0.3.0 re-consume |
| Status       | open                        |
| Disposition  | —                           |
| Graduated to | —                           |

## What happened

With the rollup native binding present (see F-001), `npx hf build --protocol v1` in a fresh `@hyperfrontend/features@0.3.0` project fails at `buildStart`: `[plugin typescript] @rollup/plugin-typescript: Could not find module 'tslib', which is required by this plugin. Is it installed?`. The bundled `@rollup/plugin-typescript` resolves `tslib` from the consumer's `node_modules` at build time, but the published package does not declare it, and nothing else in a minimal project provides it.

## Why it's friction (consumer lens)

Second independent crash on the same happy path, surfacing only after the consumer has already debugged one missing-module failure. The error names an npm package the consumer never chose to use, from a plugin they cannot see. Installing `tslib` manually fixes it, but nothing explains that, and projects that happen to hoist `tslib` (most TS apps with `importHelpers` toolchains) never see it — making it look machine-specific.

## Proposed fix / improvement

Declare `tslib` in the published `dependencies` of `@hyperfrontend/features` and `@hyperfrontend/builder`. Declaring it in the source manifest alone is not enough: the packaging pipeline bundles it into `_dependencies/tslib/` and then strips it from the published `dependencies` as a bundled dep — but `_dependencies` is not `node_modules`, so the plugin's `require.resolve('tslib')` can never see that copy. The fix is to exclude `tslib` from the `bundleAllDeps` pass (build config `bundleAllDeps: { exclude: ["tslib"] }`) so it stays a declared external the consumer installs normally — same class as the F-001 bindings but a plain dependency rather than a platform-conditional one.

## Repro / evidence

```sh
# continuing from the F-001 repro, with the binding workaround applied:
npm i -D rollup@4.59.0
npx hf build --ci --name x --version 1.0.0 --contract x.contract.ts --url https://example.com --protocol v1
# → RollupError: [plugin typescript] @rollup/plugin-typescript: Could not find module 'tslib'
npm i -D tslib
npx hf build ...   # → succeeds, emits dist/x-shell/x-shell-1.0.0.tgz
```

Verified 2026-08-01 against the npm registry on linux-x64 with Node 24.18.1.
