# F-001 — `hf build` crashes in a fresh project: `Cannot find module @rollup/rollup-linux-x64-gnu`

| Field        | Value                       |
| ------------ | --------------------------- |
| Category     | packaging                   |
| Severity     | blocker                     |
| Surfaced by  | demo-clock 0.3.0 re-consume |
| Status       | open                        |
| Disposition  | —                           |
| Graduated to | —                           |

## What happened

In a brand-new project with nothing but `@hyperfrontend/features@0.3.0` installed, `npx hf build --protocol v1` crashes before emitting anything. The bundled rollup worker under `_dependencies/@hyperfrontend/builder/bundle/rollup/worker/` calls rollup's `requireNative()`, which requires the platform-specific binding package (`@rollup/rollup-linux-x64-gnu` on Linux x64). That package is never installed: the published `@hyperfrontend/features` declares only `typescript` as a dependency, and native `.node` binaries cannot be bundled into `_dependencies/`. The error even surfaces npm's misleading stock advice ("remove package-lock.json and node_modules and retry"), which does not help.

`hf init`, `hf dev`, and every SDK import subpath work fine in the same project — only `build` is broken.

## Why it's friction (consumer lens)

The advertised zero-config path — install one package, run `hf build`, get a self-contained shell tarball — does not survive first contact on a clean machine. It happens to work in projects that already hoist a rollup native binding (e.g. Vite 5–7 apps), which makes the failure look environment-specific and hard to self-diagnose: nothing in the error mentions `@hyperfrontend/features`, and the suggested remedy is a dead end. Vite 8 apps (rolldown-based) and non-Vite projects hit it every time. `@hyperfrontend/builder` has the same gap for direct consumers.

## Proposed fix / improvement

Declare rollup's platform binding packages in the published `optionalDependencies` of `@hyperfrontend/features` and `@hyperfrontend/builder`, pinned to the bundled rollup version — npm then installs exactly the binding matching the consumer's platform, the same way rollup itself ships. The publish pipeline already passes `optionalDependencies` through to the output manifest verbatim. A friendlier preflight error from `hf build` naming the missing binding (and the one-line fix) would cover exotic platforms where no binding exists.

## Repro / evidence

```sh
mkdir scratch && cd scratch && npm init -y
npm pkg set type=module
npm i @hyperfrontend/features@0.3.0
printf 'export default { name: "x", version: "1.0.0", accepted: [], emitted: [] }\n' > x.contract.ts
npx hf build --ci --name x --version 1.0.0 --contract x.contract.ts --url https://example.com --protocol v1
# → Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
#   Require stack: node_modules/@hyperfrontend/features/_dependencies/@hyperfrontend/builder/bundle/rollup/worker/index.cjs.js
```

Verified 2026-08-01 against the npm registry on linux-x64 with Node 24.18.1; `ls node_modules/@rollup` in the scratch project is empty.
