# 13 — v2 Release

Close the proof loop: triage the accumulated findings into concrete v2 changes, publish, and refresh the docs. The demos that exposed the rough edges become the demos that show them sanded down.

**Depends on** all prior plans (consumes the [findings registry](findings/README.md)) · **Type** D+E · **Status**: Pending — not yet elaborated.

See [00-strategy.md](00-strategy.md) (journey J7) and the [index](README.md).

## Scope (to elaborate)

- **Triage** the findings registry: set dispositions, pick the v2 cut line, group fixes (API refinements, new features incl. the plugin system [05](05-plugin-system.md), error-message improvements, packaging fixes).
- Implement the cut, version-bump, and **publish** `@hyperfrontend/features` v2 (use `@hyperfrontend/versioning` discipline).
- Refresh README / ARCHITECTURE / `@example` blocks / how-to guides / docs-site to match the v2 reality.
- Optionally graduate findings to public GitHub issues for portfolio-visible evidence of rigor.

## Open questions

- v2 scope cut line (which severities make the cut) and whether to ship one v2 or rolling minors.
- Whether docs/how-tos ship with v2 or trail it.
