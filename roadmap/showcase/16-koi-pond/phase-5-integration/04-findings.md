# Findings

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md) · Registry:
[findings/README.md](../../findings/README.md)

## Goal

Close the loop on the findings ledger: file every SDK gap this plan surfaced, and record
graduations for the ones this plan resolved. Process and template: the `demo-findings`
skill.

## To file (confirmed already; file when their work items land, if not filed then)

- **No hosted/standalone signal on the feature handle** (F-020 if still free): filed as
  part of [phase 2 item 01](../phase-2-isolated-improvements/01-lib-features-hosted.md),
  which also graduates it in the same release.
- **Visibility edges are trusted where visibility state is the truth**: the SDK-side
  twin of the pond's [visibility polling](../phase-2-isolated-improvements/02-visibility-polling.md);
  the demo carries the workaround, the finding records the SDK exposure.

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
  [phase 2 item 04](../phase-2-isolated-improvements/04-docs-embed-resurrection.md);
  record the graduation per the registry's rules once released.

## Specs

None (registry maintenance).

## Documentation impact

- Registry rows and finding files only; findings are internal roadmap material and may
  reference this plan freely (guardrail 1 restricts shipped surfaces, and the registry
  is not shipped).

## Verification

None beyond the registry's own conventions.
