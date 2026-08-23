# Findings

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md) · Registry:
[findings/README.md](../../findings/README.md)

## Goal

Close the loop on the findings ledger: file every SDK gap this plan surfaced, and record
graduations for the ones this plan resolved. Process and template: the `demo-findings`
skill.

## Filed already (graduations pending the SDK release)

- **F-020**: no hosted/top-level signal on the feature handle.
- **F-021**: a missed visibility edge parks every watchdog at `unobservable` and nothing
  resets it.

Both are answered by the
[phase 2 release](../phase-2-isolated-improvements.md#release-gate-cleared) (features
0.8.0, published 2026-08-23). **Done:** the registry tracks open friction only, so both
rows and both files were removed.

## To evaluate during the instance work (file only if confirmed)

- Host boot context on `Present`: the pond needed scene semantics before opening
  sessions and got them via gallery `set-scene` timing plus a fallback deadline; a
  host-declared boot hint on the presentation payload would remove the deadline
  entirely. File if the deferred-boot implementation confirms the friction is real
  rather than theoretical. **Not filed:** the choreography sends the scene cue on the
  shell's `open` event, so every real presentation names its scene inside the first
  handshake and the deadline is never reached. The friction stayed theoretical.
- Anything else the instance refactor, dynamic shoal, or choreography surfaces:
  unclear APIs, confusing errors, DX papercuts. The invariant stands: file before
  working around. **Nothing new filed:** the one problem the choreography surfaced was
  gallery-side (a scene cue gated on liveness cannot reach a feature whose liveness
  depends on the cue), and `open` is the SDK hook that answers it.

## Graduations to record

- F-018 (no way to revive a dead session) and F-019 (dead iframe paints the crash
  placeholder): the gallery-side handling ships in
  [phase 2](../phase-2-isolated-improvements.md#gallery-outer-resurrection); record the
  graduation per the registry's rules once released. **Done as triage, not clearance:**
  both ask the SDK for an affordance it still does not have, and the shipped policy is
  the hand-rolled machine they describe, so both are `triaged` / `api-refinement`
  against the phase 2 record and stay in the registry.

## Specs

None (registry maintenance).

## Documentation impact

- Registry rows and finding files only; findings are internal roadmap material and may
  reference this plan freely (guardrail 1 restricts shipped surfaces, and the registry
  is not shipped).

## Verification

None beyond the registry's own conventions.
