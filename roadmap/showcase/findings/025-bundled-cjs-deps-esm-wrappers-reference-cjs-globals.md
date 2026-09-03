# F-025 — bundled CJS deps' ESM wrappers still reference `__dirname` and `require`, so four builder ESM entries throw on import

| Field        | Value             |
| ------------ | ----------------- |
| Category     | other             |
| Severity     | high              |
| Surfaced by  | jest-to-node-test |
| Status       | open              |
| Disposition  | —                 |
| Graduated to | —                 |

## What happened

A native-ESM link sweep of every `import` condition in every published package's `exports` map
(run 2026-09-03 while auditing the F-023/F-024 blast radius) found a third, distinct failure
class in `@hyperfrontend/builder`. Four ESM entries — `./bundle/dependencies`,
`./bundle/dependencies/worker`, `./bundle/rollup`, `./bundle/rollup/worker` — throw before any
consumer code runs:

```
ReferenceError: __dirname is not defined in ES module scope
    at requireNative (.../_dependencies/rollup/index.esm.js:144:24)
```

The bundled `rollup` dependency's own `native.js` locates its platform binding with
`existsSync(path.join(__dirname, localName))` and loads it through a dynamic `require(id)`. The
pre-pass CJS-to-ESM wrap (with `ignoreDynamicRequires`) leaves both verbatim: in the CJS twin
they are real module-scope bindings, in the ESM chunk they are undefined globals. Because the
wrapper evaluates `requireNative()` at module top level, the `ReferenceError` fires the moment
the chunk is imported. Any bundled CJS dependency reading `__dirname`, `__filename`, or a
dynamic `require` at evaluation time fails the same way.

## Why nobody saw it

The same blindness recorded in F-023 and F-024: every consumer to date reaches these chunks
through a CommonJS transform, where the CJS twin supplies all three bindings natively. Only a
native-ESM import of the affected entries evaluates the broken wrapper.

## Why it matters

Four of the published builder's ESM entries are unusable in any native-ESM Node consumer, and
the failure names a bundled `_dependencies` chunk rather than anything the consumer did. It is
also latent in every future package that bundles a CJS dependency touching CJS module-scope
globals.

## What would resolve it

A post-emit pass that gives each affected ESM chunk the bindings its CJS twin evaluates under —
`createRequire(import.meta.url)` for `require`, `fileURLToPath(import.meta.url)` for
`__filename` / `__dirname` — then a republish of `@hyperfrontend/builder` alongside the F-024
fix.
