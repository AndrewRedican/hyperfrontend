# F-023 — the network-protocol ESM build ships a broken module graph that only native ESM consumers can see

| Field        | Value             |
| ------------ | ----------------- |
| Category     | other             |
| Severity     | high              |
| Surfaced by  | jest-to-node-test |
| Status       | open              |
| Disposition  | —                 |
| Graduated to | —                 |

## What happened

Running the packed `@hyperfrontend/network-protocol` tarball's ESM entries under Node's native
module loader fails at link time, before any test body runs:

```
_shared/lib/data/validations/is-valid-message/index.esm.js:1
import { data, message, key } from '../../creators/mocks/index.esm.js';
SyntaxError: The requested module '../../creators/mocks/index.esm.js' does not provide an export named 'data'
```

Two things are wrong with the emitted `_shared` tree, and both point at the first-party dedupe
pass (`libs/builder/src/bundle/dedupe/`):

- `_shared/lib/data/creators/mocks/index.esm.js` contains `var id = "/v4"; export { id };` — the
  content of a sibling schema-id module, not the `data/creators/mocks` source, which exports
  `pid`, `id`, `sequence`, `key`, `message`, and `schema`.
- `_shared/lib/data/validations/is-valid-message/index.esm.js` imports `{ data, message, key }`
  from that mocks chunk, though the `is-valid-message.ts` source imports nothing from any mocks
  module.

Reproduced deterministically: `rm -rf dist/libs/network-protocol && nx build
lib-network-protocol --skip-nx-cache` on a quiet machine emits the same graph. This is not the
overlapping-builds race that was ruled out earlier; a solo, uncached, wiped build produces it.

**Diagnosis (2026-09-03, re-derived from the emitted artifact).** The original path-suffix lead
was wrong. Two dedupe-pass defects compound:

1. **Fixture-name misattribution.** `v4.json`'s top-level `"id": "/v4"` is inlined by the JSON
   plugin as a top-level `var id = "/v4"` in every entry reaching `is-valid-schema`. The
   ownership index scans all of `src/**`, so the spec-only fixture
   `lib/data/creators/mocks.ts` — never imported by any entry — uniquely owns `id` (and `key`,
   `message`, `data`, …). The JSON-derived declaration is attributed to the fixture's module
   key, every copy is byte-identical, and the pass emits the phantom
   `_shared/lib/data/creators/mocks/` chunk exporting only `id`.
2. **Scope-naive reference collection.** Cross-chunk import edges were computed with the prune
   pass's over-approximating `collectRefs`, which counts function parameters as references.
   `is-valid-message`'s callback parameters `key`, `value`, and the parameters `data` /
   `message` collide with fixture-owned names, fabricating the
   `import { data, message, key }` edge into the phantom chunk — names it never exports, which
   is the link error native ESM reports. CJS destructures the same names to `undefined`,
   parameters shadow them, and nothing notices.

## Why nobody saw it

Every consumer to date runs the package through a CommonJS transform. The e2e suites ran under
Jest without `--experimental-vm-modules`, so ts-jest compiled both the specs and the package's
ESM files to CJS, where a missing named export becomes `undefined` at property access instead of
a link error — and the suites never touched the affected names. Native ESM validates every named
import across the whole graph at instantiation, so the first `import()` of `node/v1` explodes.

The migration's node-runner e2e run (13 esm tests, 11 failing at link time) is what surfaced it.

## Why it matters

The published package's ESM entries are unusable in any native-ESM Node consumer, and the
failure names an internal chunk rather than anything the consumer did. The CJS entries are fine,
which is why the demos and the features bundle never noticed.

## What would resolve it

A diagnosis of the dedupe pass's module attribution for path-suffix-sharing modules, then a fix
and a republish. Until then `e2e-lib-network-protocol` stays on the legacy Jest path — the one
project of nineteen the jest-to-node-test Phase 6 migration cannot flip, because its node run
correctly refuses to load the broken graph.
