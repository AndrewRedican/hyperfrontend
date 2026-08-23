# Vitals updates

Part of [Phase 4](README.md) · Guardrails: [plan index](../README.md)

## Goal

The `?vitals=1` overlay follows the instance model: per-instance rows and a boot record
that names the device tier, so device evidence sessions can see roster churn and cap
behavior directly.

## Files

- `apps/demos/koi-pond/host/src/components/vitals.ts`
- Specs: `apps/demos/koi-pond/host/src/components/__tests__/vitals.spec.ts` (extend)

## Design

- **Rows**: one probe row per live instance, labeled framework plus ordinal; rows appear
  and disappear with roster churn instead of the fixed eight (the keying landed in
  [phase 3 item 01](../phase-3-instance-model/01-instance-id-refactor.md); this is the
  display side).
- **Log lines**: roster changes (`add`/`remove` with instance id) and cap refusals (with
  the tier named) enter the persisted log via the existing `onDiagnostic` channel.
- **Boot record**: the first log line records the device tier and the derived cap next
  to the existing boot facts.
- Probe semantics are untouched: classification pierces shadow roots, never calls
  `getContext`, cross-origin classifies as inaccessible.

## Specs

- Rows track a scripted add/remove sequence.
- Cap-refusal and roster-change lines appear in the ring buffer and survive the persist
  round-trip.
- Boot record carries tier and cap.

## Documentation impact

- The koi skill's vitals row (key files and the `?vitals=1` recipe) is refreshed in
  [phase 5](../phase-5-integration/03-doctrine-rewrites.md).

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
