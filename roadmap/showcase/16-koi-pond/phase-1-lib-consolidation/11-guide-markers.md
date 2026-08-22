# Guide extraction markers

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[04-contract-0-8-0.md](04-contract-0-8-0.md)

## Goal

Keep the docs-site guide extraction green while the wire plumbing moves into the lib. The
guides pipeline live-extracts marked regions from demo sources; a moved region with a stale
`snippetSources` pointer breaks the guides build.

## Current marker inventory (compose-independent-features)

Declared in `apps/docs-site/content/guides/compose-independent-features/meta.json`
`snippetSources`, parsed by `apps/docs-site/scripts/generate-guides.ts` (region syntax
`ref: [guide:slug/region]`):

- `apps/demos/koi-pond/fish-vanilla/feature.config.ts`: region `fish-config` (stays; the
  config layer is per-app and does not move)
- `apps/demos/koi-pond/fish-vanilla/koi-fish.contract.ts`: region `shared-contract` (stays;
  the fish contract file remains as the re-export)
- `apps/demos/koi-pond/fish-vanilla/src/feature/wire-contract.ts`: region
  `neighbors-handler` (**moves**: the region's code lands in
  `apps/demos/koi-pond/lib/src/contract/wire.ts`)
- `apps/demos/koi-pond/host/src/hyperfrontend.feature.ts`: `outer-boundary` (stays)
- `apps/demos/koi-pond/host/src/scene/koi-sessions.ts`: `shell-factories`, `open-shoal`
  (stay in this phase; re-verified after the
  [phase 3 instance refactor](../phase-3-instance-model/01-instance-id-refactor.md))
- `apps/demos/koi-pond/host/src/scene/pond.ts`: `survive-close`, `retry-open`,
  `relay-fanout` (same: stay now, re-verify after phase 3)

## Steps

1. When the wire port lands, move the `neighbors-handler` region markers into
   `lib/src/contract/wire.ts` around the equivalent code.
2. Re-point the corresponding `snippetSources` entry in the guide's `meta.json`.
3. Read the surrounding prose of `guide.md` around that snippet: the guide currently
   presents the handler as fish-app code. Adjust the sentence so it truthfully describes
   the shared plumbing the fish app calls, in present-state wording, without narrating the
   move (guardrails 1 and 3; no em dashes in `guide.md`).
4. Run the guides generator and the link checker; both must pass in the same change.

## Specs

None (docs pipeline; the generator run is the check).

## Documentation impact

- `meta.json` snippetSources re-point; one or two sentences of `guide.md` prose.
- This is the only phase-1 item that touches shipped docs.

## Verification

```bash
npx nx test docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
npx nx format:write --projects=docs-site
```

Plus the guides generator and link checker as wired in the docs-site build (the
`docs-site` build target runs generation; a full `npx nx run docs-site:build` is the
authoritative gate).
