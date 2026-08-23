# Deferred boot

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[01-instance-id-refactor.md](01-instance-id-refactor.md), and the `hosted` signal
[**published to npm**](../phase-2-isolated-improvements.md#release-gate-blocks-phase-3-item-03)
· Evidence:
[recon §2](../recon.md#2-scene-signals-when-a-pond-can-know-card-vs-full)

## Goal

Stop opening eight shells during module eval. The pond decides its scene before opening
anything: standalone opens the full profile instantly; hosted defers until the host says
what it mounted.

## Files

- `apps/demos/koi-pond/host/src/hyperfrontend.feature.ts` (boot order)
- `apps/demos/koi-pond/host/src/scene/pond.ts` (shell opening moves out of construction)
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **Standalone (`feature.hosted === false`)**: the answer is synchronous; open the full
  profile immediately (initial trio, tier cap applies). Zero added latency over today.
- **Hosted (`feature.hosted === true`)**: create the stage and water, hold the curtain,
  and defer session opening until the first `presentation` or `set-scene` arrives. The
  first `set-scene 'card'` lands about one render after the handshake (recon §2), so the
  wait is milliseconds in practice. A fallback deadline of about 1 second covers a host
  that never sends scene semantics: on expiry, open the full profile.
- **Scene is decided once per instance; instances never morph.** A card pond never
  becomes a full pond in place; the gallery destroys and reopens
  ([phase 5 choreography](../phase-5-integration/01-expand-choreography.md)). A late
  `set-scene` that contradicts the decided scene is logged through `onDiagnostic` and
  ignored.
- The pond keeps its doctrine: no URL params, no `window.parent`; `hosted` comes from the
  SDK handle, scene semantics from host announcements only.

## Specs

- Standalone fake-host spec: sessions open in the same tick as boot; roster is the trio.
- Hosted: no session opens before the signal; `set-scene 'card'` opens the card profile;
  `set-scene 'full'` (or `presentation` plus deadline) opens the full profile; the
  deadline path opens full.
- Contradictory late scene signals are ignored and diagnosed.

## Documentation impact

- None shipped in this sub-plan; the koi skill and pond README describe the final
  behavior in [phase 5](../phase-5-integration/03-doctrine-rewrites.md).

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
