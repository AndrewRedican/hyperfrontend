# F-024 — the builder's ESM bundle of postject drops its named export, breaking the package's own ESM entry

| Field        | Value             |
| ------------ | ----------------- |
| Category     | other             |
| Severity     | high              |
| Surfaced by  | jest-to-node-test |
| Status       | open              |
| Disposition  | —                 |
| Graduated to | —                 |

## What happened

Running the packed `@hyperfrontend/builder` tarball's main ESM entry under Node's native module
loader fails at link time, before any test body runs:

```
node_modules/@hyperfrontend/builder/_shared/bin/native/inject/index.esm.js:1
import { inject } from '../../../../_dependencies/postject/index.esm.js';
SyntaxError: The requested module '../../../../_dependencies/postject/index.esm.js' does not provide an export named 'inject'
```

The emitted `_dependencies/postject/index.esm.js` is a CJS-interop wrapper that builds the
module's API into `var apiExports = requireApi();` as its final statement and then ends. It has
no `export` statement at all, so as an ES module it exports nothing. Its CJS twin in the same
directory is fine: it closes with `getDefaultExportFromCjs(apiExports)` and
`module.exports = api`. The first-party consumer `_shared/bin/native/inject/index.esm.js`
imports the named binding `inject` from the wrapper, so every ESM graph that reaches the native
SEA inject module refuses to instantiate.

Unlike F-023 this is not the first-party dedupe pass misattributing modules; the broken file is
the third-party `_dependencies` emission itself.

**Diagnosis (2026-09-03, pre-pass reproduced in isolation).** The wrap never emitted `inject`
in the first place: postject's `module.exports` is assembled inside the lazy `require` closure,
so the commonjs plugin can only emit `export { api as default }`. The dead-export prune then
correctly removed that default (no importer uses it) together with its now-dead interop
declaration, which is why the file ends at `var apiExports = requireApi();`. The defect is that
named imports against a default-only CJS wrap are never satisfiable in ESM, while the CJS twin
resolves the same names at runtime. The published `@hyperfrontend/builder@0.2.0` tarball was
pulled from the registry and carries the broken wrapper verbatim, so the breakage is public,
not just local.

## Why nobody saw it

The same blindness recorded in F-023: every consumer to date runs the package through a
CommonJS transform. The e2e suite ran under Jest, where ts-jest compiles the spec's
`await import('@hyperfrontend/builder')` to CJS interop, so the real ESM graph never linked and
the Jest esm format reported 3/3 green against a broken graph. Native ESM validates every named
import across the whole graph at instantiation, so the node runner's first `import()` of the
main entry explodes. The `/presets` subpath does not traverse the native inject module and
still links.

Surfaced 2026-09-03 by the jest-to-node-test migration's attempt to flip `e2e-lib-builder`:
the node cjs run matched the Jest baseline 7/7, and the node esm run failed 2/3 with the link
error above.

## Why it matters

The published package's main ESM entry is unusable in any native-ESM Node consumer, and the
failure names an internal `_dependencies` chunk rather than anything the consumer did. The CJS
entry and bin are fine, which is why the CLI and every transpiled consumer never noticed.

## What would resolve it

A diagnosis of why the bundled dependency's ESM wrapper omits its export statement (the CJS
twin proves the interop machinery knows the module's shape), then a fix and a republish of
`@hyperfrontend/builder`. Until then `e2e-lib-builder` stays on the legacy Jest path alongside
`e2e-lib-network-protocol` (F-023); its node esm run correctly refuses to load the broken
graph, so flipping it before the fix would land a permanently red e2e.
