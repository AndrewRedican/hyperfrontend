# fish.css export

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §1](../recon.md#1-duplication-across-the-eight-fish-apps)

## Goal

One copy of the fish chrome stylesheet, shipped from the lib package: the file is
byte-identical across seven apps (lit keeps its shadow styles and is untouched).

## Files

- New: `apps/demos/koi-pond/lib/src/styles/fish.css` (ported byte-for-byte from
  `apps/demos/koi-pond/fish-vanilla/src/styles/fish.css`)
- `apps/demos/koi-pond/lib/package.json`: add a `"./fish.css"` entry to the `exports` map
  and make sure the file lands in the packed tarball (`files` allowlist / build copy)

## Design

- The lib is consumed as a committed `file:` tarball; each fish's vite build must resolve
  `@hyperfrontend/demo-koi-lib/fish.css` from that tarball. Verify resolution inside one
  consumer build before calling this done (the vanilla app is the cheapest probe); the
  actual import swap across the seven apps happens in
  [phase 3 migration](../phase-3-instance-model/05-fish-migration.md).
- Lit's stub stylesheet (transparent box) and shadow sheet stay app-local: that split is
  idiomatic and intentional.
- **Considered and rejected: runtime injection via `@hyperfrontend/ui-utils`
  `addStylesheet`.** That utility exists for widgets living in documents they do not own,
  where rules must be injectable and removable at runtime. Every koi app owns its whole
  iframe document, so its base chrome is a load-time fact: a build-time stylesheet gets
  bundling, minification, caching, and existence-before-script, with nothing to ever
  remove. ui-utils belongs in a DOM-injected widget demo, not here. (A future
  hosted-vs-direct-visit theming split keys static CSS off a root `data-` attribute; it
  does not change this call.)

## Specs

- Lib packaging spec (or `demo-koi-lib:verify` extension): the packed tarball contains
  `fish.css` and the export entry resolves.

## Documentation impact

- None beyond the `exports` map itself.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
npx nx run demo-koi-lib:build && npx nx run demo-koi-lib:refresh && npx nx run demo-koi-lib:verify
```
