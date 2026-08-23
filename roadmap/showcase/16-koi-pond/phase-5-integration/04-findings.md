# Findings

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md) · Registry:
[findings/README.md](../../findings/README.md)

## Goal

Close the loop on the findings ledger: file every SDK gap this plan surfaced, and record
graduations for the ones this plan resolved. Process and template: the `demo-findings`
skill.

## Filed already (graduations pending the SDK release)

- **[F-020](../../findings/020-feature-cannot-know-it-is-unhosted.md)**: no
  hosted/standalone signal on the feature handle.
- **[F-021](../../findings/021-missed-visibility-edge-parks-the-watchdog-for-the-session.md)**:
  a missed visibility edge parks every watchdog at `unobservable` and nothing resets it.

Both are answered by the
[phase 2 release](../phase-2-isolated-improvements.md#release-gate-cleared) (features
0.8.0, published 2026-08-23); record each graduation.

## To evaluate during the instance work (file only if confirmed)

- Host boot context on `Present`: the pond needed scene semantics before opening
  sessions and got them via gallery `set-scene` timing plus a fallback deadline; a
  host-declared boot hint on the presentation payload would remove the deadline
  entirely. File if the deferred-boot implementation confirms the friction is real
  rather than theoretical.
- Anything else the instance refactor, dynamic shoal, or choreography surfaces:
  unclear APIs, confusing errors, DX papercuts. The invariant stands: file before
  working around.

## Graduations to record

- F-018 (no way to revive a dead session) and F-019 (dead iframe paints the crash
  placeholder): the gallery-side handling ships in
  [phase 2](../phase-2-isolated-improvements.md#gallery-outer-resurrection); record the
  graduation per the registry's rules once released.

## Specs

None (registry maintenance).

## Documentation impact

- Registry rows and finding files only; findings are internal roadmap material and may
  reference this plan freely (guardrail 1 restricts shipped surfaces, and the registry
  is not shipped).

## Verification

None beyond the registry's own conventions.
