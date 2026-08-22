# Device tier

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md)

## Goal

A tiny classification module that turns device capability into the shoal cap:
`{low: 4, middle: 8, high: 12}`. Capability signals only; no user-agent sniffing ever.

## Files

- New: `apps/demos/koi-pond/host/src/runtime/device-tier.ts`
- Specs: `apps/demos/koi-pond/host/src/runtime/__tests__/device-tier.spec.ts` (new)

## Design

- Inputs: `navigator.deviceMemory` (coarse, rounded GB; absent on Safari and Firefox) and
  `navigator.hardwareConcurrency` (broadly available).
- Classification (locked):
  - **low**, cap 4: memory at most 2GB, or at most 4 cores;
  - **high**, cap 12: memory at least 8GB and at least 8 cores;
  - **middle**, cap 8: everything else, and whenever `deviceMemory` is absent (Safari and
    Firefox land here by construction; unknown means middle, never low).
- Duplicates only become reachable above 8, so only high-tier devices can hold twins
  (locked decision; the cap is the only mechanism, no separate duplicate gate).
- `deviceMemory` is not in the standard DOM lib types: type the access with a local
  interface extension inside the module, no global augmentation, no `any`.
- Export both the tier name and the cap; the tier name goes into the vitals boot record
  ([phase 4, vitals](../phase-4-chrome-and-overlay/05-vitals-updates.md)) and the cap
  feeds the shoal machinery
  ([phase 3, dynamic shoal](../phase-3-instance-model/02-dynamic-shoal.md)).

## Specs

- Classification matrix: each boundary value lands on the decided side (2GB/4 cores low;
  8GB/8 cores high; 6GB/8 cores middle; 8GB/6 cores middle).
- Absent `deviceMemory` with high concurrency is still middle.
- Absent both signals: middle.

## Documentation impact

- None shipped; the module's JSDoc states the classification as present-state fact.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
