# Contract 0.8.0 and wire plumbing

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §2](../recon.md#2-scene-signals-when-a-pond-can-know-card-vs-full) and
[recon §4](../recon.md#4-a-container-derived-card-world)

## Goal

One inner-contract bump, 0.7.0 to 0.8.0, carrying all three additions the plan needs, plus
the shared wire plumbing ported into the lib. Both sides must agree on major and minor
below 1.0.0, so the bump only becomes live when host and fish repack together in
[phase 3](../phase-3-instance-model/06-repack-pipeline.md); this sub-plan prepares the lib
side.

## Files

- `apps/demos/koi-pond/lib/src/contract/koi-fish.contract.ts` (version to 0.8.0, payload
  additions)
- New: `apps/demos/koi-pond/lib/src/contract/wire.ts` exporting `wireKoiContract`
- Source of the wire port: `apps/demos/koi-pond/fish-vanilla/src/feature/wire-contract.ts`
  (7 of 8 copies within 0 to 4 stripped lines)
- Specs: `apps/demos/koi-pond/lib/src/contract/__tests__/` (extend/new)

## Design

### Contract additions

- `pause` payload gains `resting?: boolean`. Semantics: with `paused: true, resting: true`
  the fish holds position and sculls, and suppresses the held-inspection chrome (no held
  silhouette, no identity card, no inspector timers). The runtime honors it in
  [05-runtime.md](05-runtime.md); the card host sends it in
  [phase 3](../phase-3-instance-model/04-card-profile.md).
- `identity` gains `instance: number`: 0 for the canonical fish of a framework, 1..n for
  duplicates. The host-chosen `seed` remains the authority the fish already obeys
  ([06-variant-seeds.md](06-variant-seeds.md) makes the host derive it per instance).
- `outline` optionally carries `path?: Vec2[]`, capped at 20 points, produced by
  [predictPath](03-predicted-path.md). The outline stays a schema-less hot path by design;
  the cap is enforced by the producer, not by wire validation.

### Wire plumbing port

- Port `wireKoiContract` from the vanilla copy; adopt the hoisted `NEIGHBOR_NUMBERS` form
  and lit's `readShoal` extraction (both are the cleanest drift variants). The module stays
  deliberately SDK-free: it types against the structural `FeatureLink`, so the lib gains no
  `@hyperfrontend/features` dependency.
- The vanilla copy carries guide extraction markers; moving them is
  [11-guide-markers.md](11-guide-markers.md) and must land in the same change as this port.

## Specs

- Version constant reads 0.8.0; major/minor agreement helper (if present) accepts 0.8.x
  and rejects 0.7.x.
- `wireKoiContract` routes each action to its handler; `pause` with and without `resting`
  reaches the consumer distinctly; unknown fields on the schema-less outline pass through
  untouched.
- Type-level: `identity.instance` and `outline.path` compile as optional/required exactly
  as decided (instance required in the 0.8.0 identity payload; path optional).

## Documentation impact

- Contract JSDoc: document `resting`, `instance`, and `path` semantics on the payload
  types, present-state, no version narration beyond the version constant itself.
- The compose-independent-features guide extracts wire regions; handled in
  [11-guide-markers.md](11-guide-markers.md) and verified again in
  [phase 5](../phase-5-integration/02-guides-verification.md).

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
