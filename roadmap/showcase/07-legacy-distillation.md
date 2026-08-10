# 07 — Legacy Distillation (extract-then-delete)

Distill only the still-valuable complete technical designs from the untracked `_/` directory, commit the keepers, then delete the legacy subtrees (~144 MB, measured 2026-08-05) **once and for all**. Runs parallel to everything; blocks nothing.

**Type** Discovery · **Status**: Pending — not yet elaborated.

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Critical constraint

`_/` is **gitignored and 100% untracked** — deletion is irreversible. **Commit every keeper into version control before deleting anything.**

## Scope (to elaborate)

- Anchor on the existing synthesis (`_/LEGACY_PROJECTS_ANALYSIS.md`).
- Write one **distilled-idea stub** per keeper into a committed `legacy-distilled/` home (recreated when this plan runs), tagged `adopt` / `adapt` / `reimagine` + which plan it feeds.
- Commit verbatim the **Tier-1 keepers** into the same committed `legacy-distilled/` home.
- Verify nothing in `_/` is referenced by tracked code, then **delete the legacy project subtrees**.
- **Delete scope**: the legacy project subtrees only. Anything since placed under `_/` that is deliberately kept untracked is out of this plan's scope and stays.

## Tier-1 keepers (from recon)

Re-validate each keeper before committing — some target plans have since delivered, which may reduce a keeper to historical reference that no longer earns a commit.

| Keeper                                     | Why it's worth saving                                           | Likely feeds                                                    |
| ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Fluent **Connector API** source            | Ancestor of today's shell; ergonomics & display-mode branching  | host DX (re-validate: the shell/plugin seam has since shipped)  |
| Bidirectional **contract/action** patterns | Type-safe symmetric `accepted`/`emitted` with schema validation | catalog contracts                                               |
| **Scenario-based mock-backend** model      | Happy/slow/unavailable/missing-data switching for demo data     | [08](08-breadth-boundary-respecting.md)                         |
| Dual-distribution model (npm + CDN)        | Proven reach pattern                                            | docs refresh (re-validate: the release loop has since executed) |
| `LEGACY_PROJECTS_ANALYSIS.md`              | The lineage synthesis itself                                    | reference                                                       |

## Open questions

- Confirm which keepers genuinely feed which plan before committing (avoid hoarding).
- Cold-storage of the bulk before deletion — not needed if all value is committed, but confirm.
