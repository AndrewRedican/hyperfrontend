# Instance-ID refactor

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §3](../recon.md#3-eight-fish-assumptions-in-the-host)

## Goal

The host's session key changes from `KoiFramework` to `KoiInstanceId` (framework +
ordinal). This is the enabling refactor for duplicates and the dynamic roster; it changes
keying and creation, not behavior.

## Files (every map that re-keys)

- `apps/demos/koi-pond/host/src/scene/koi-sessions.ts`: gains
  `openInstance(framework, ordinal)` building a layer plus shell on demand.
  `SHELL_FACTORIES` stays the total per-framework `Record` (it is per-framework by
  nature; all eight vendored shells stay bundled and each stays in `dependency-checks`
  `ignoredDependencies` by exact name, guardrail 8). `fishHomeUrl` and the shell factory
  lookup stay framework-keyed; everything session-shaped becomes instance-keyed.
- `apps/demos/koi-pond/host/src/scene/stage.ts`: layers created and destroyed dynamically
  per instance instead of eight-at-construction (`stage.ts:52-58` is the current gate).
- `apps/demos/koi-pond/host/src/scene/pond.ts`: `present`, `retries`, `inspected`, drag
  and hover state all re-key by instance.
- `apps/demos/koi-pond/host/src/scene/relay.ts`: records key by reporting instance;
  neighbor fan-out excludes **self by instance**, not by framework, so twins see each
  other as neighbors (this is what makes duplicate avoidance work).
- `apps/demos/koi-pond/host/src/scene/selection.ts`: per-instance chrome.
- `apps/demos/koi-pond/host/src/scene/resurrection.ts`: budgets per instance.
- `apps/demos/koi-pond/host/src/components/vitals.ts`: rows per instance (display work in
  [phase 4](../phase-4-chrome-and-overlay/05-vitals-updates.md); the keying lands here).
- `apps/demos/koi-pond/host/src/scene/depth-director.ts`: the spread derives from the
  **live instance count**, not `KOI_FRAMEWORKS.length` (`depth-director.ts:71` today).
  This also fixes the solo-depth bug (recon §3): one fish spreads to the surface level
  instead of staying pinned at its canonical slot, dim and blurred with ripples disabled.
  More than 7 instances double up levels exactly as the 8-fish pond already does.
- Identity: `identityFor` sends `koiVariantSeed(framework, ordinal)` and
  `instance: ordinal` per the 0.8.0 contract.

## Design notes

- `KoiInstanceId` should be a value usable as a map key (string form
  `framework:ordinal` or a branded string); pick one representation and use it
  everywhere, converting at the wire boundary only.
- The sequence tracker and curtain already count sessions, not frameworks, and need only
  the key-type change.
- Guide extraction markers live inside `koi-sessions.ts` (`shell-factories`,
  `open-shoal`) and `pond.ts` (`survive-close`, `retry-open`, `relay-fanout`): keep the
  marked regions intact and semantically true through the refactor; the extraction run in
  [phase 5](../phase-5-integration/02-guides-verification.md) is the check, but do not
  knowingly leave a marker around code whose meaning changed.

## Specs

- Existing host scene suites re-keyed and green; new cases: two instances of one
  framework hold distinct present/inspected/drag state; relay fan-out from twin A
  includes twin B and never itself; depth spread for rosters of size 1, 3, 8, and 12
  (doubling) matches the derivation.
- Resurrection budgets are independent per twin.

## Documentation impact

- None shipped in this sub-plan (phase 5 batches the prose). Marker integrity as above.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
