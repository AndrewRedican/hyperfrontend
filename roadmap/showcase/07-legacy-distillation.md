# 07 — Legacy Distillation (extract-then-delete)

Distill only the still-valuable complete technical designs from the untracked `_/` directory, commit the keepers, then delete the 162 MB **once and for all**. Runs parallel to 04–06; blocks nothing.

**Depends on** [01](../../.claude/skills/demo-findings/SKILL.md) · **Type** Discovery · **Status**: Pending — not yet elaborated.

See [00-strategy.md](00-strategy.md) (journey J4) and the [index](README.md).

## Critical constraint

`_/` is **gitignored and 100% untracked** — deletion is irreversible. **Commit every keeper into version control before deleting anything.**

## Scope (to elaborate)

- Anchor on the existing synthesis (`_/LEGACY_PROJECTS_ANALYSIS.md`).
- Write one **distilled-idea stub** per keeper into a committed `legacy-distilled/` home (recreated when this plan runs), tagged `adopt` / `adapt` / `reimagine` + which plan it feeds.
- Commit verbatim the **Tier-1 keepers** into a committed `legacy-distilled/` home (recreated when this plan runs).
- Verify nothing in `_/` is referenced by tracked code, then **delete `_/`**.

## Tier-1 keepers (from recon)

| Keeper                                     | Why it's worth saving                                           | Likely feeds                            |
| ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| Fluent **Connector API** source            | Ancestor of today's shell; ergonomics & display-mode branching  | [05](05-plugin-system.md), host DX      |
| Bidirectional **contract/action** patterns | Type-safe symmetric `accepted`/`emitted` with schema validation | catalog contracts                       |
| **Scenario-based mock-backend** model      | Happy/slow/unavailable/missing-data switching for demo data     | [08](08-breadth-boundary-respecting.md) |
| Dual-distribution model (npm + CDN)        | Proven reach pattern                                            | [13](13-v2-release.md) docs             |
| `LEGACY_PROJECTS_ANALYSIS.md`              | The lineage synthesis itself                                    | reference                               |

## Open questions

- Confirm which keepers genuinely feed which plan before committing (avoid hoarding).
- Cold-storage of the bulk before deletion — not needed if all value is committed, but confirm.
