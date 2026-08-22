# Three.js stage

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §1](../recon.md#1-duplication-across-the-eight-fish-apps)

## Goal

Move the frame-box stage loop into the lib's three.js adapter as `createKoiStage`. The
source file is zero-stripped-diff across react/solid/preact/angular and open-coded with
local naming in vanilla, vue, svelte, and lit; its own header already says "nothing here is
a component".

## Files

- New: `apps/demos/koi-pond/lib/src/three/koi-stage.ts` (exported from the existing
  `./three` subpath, beside `createKoi` and `createPondView`, which it already wraps)
- Source of the port: `apps/demos/koi-pond/fish-react/src/koi/koi-stage.ts` (174 loc)
- Specs: `apps/demos/koi-pond/lib/src/three/__tests__/koi-stage.spec.ts` (new)

## Design

- **Structural pose type.** The stage currently imports each app's `KoiState`. Define a
  structural pose type in the lib (position, heading, length, speed, phase, depth) so the
  stage depends on shape, not on any app's type. The motion state satisfies it.
- **Renderer seam.** The injectable `GlRenderer` type moves with the stage so specs stay
  headless (no real WebGL in vitest).
- **Trap consolidation.** The port centralizes the twice-burned traps currently duplicated
  eight times: the turn-rate sign convention and the offscreen `lastSpeed` refresh. Encode
  each as a `// why:` single-line comment stating the invariant (guardrail 2), never the
  history.
- The idiomatic renderer layer (component, canvas ownership, lifecycle, `stage.draw`
  call site) stays per-app; that split is the demo's thesis and is not moved.

## Specs

- Headless stage against a fake `GlRenderer`: frame-box fitting, the greater-than-10
  percent refit drift rule, unit shim, and `placeKoi` produce today's numbers for a golden
  set of poses.
- Turn-rate sign: a known pose sequence renders with the same orientation signs as today.

## Documentation impact

- JSDoc on `createKoiStage` and the pose type, present-state.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
