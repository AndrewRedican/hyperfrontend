---
name: demo-findings
description: Register friction found while building hyperfrontend demos into the showcase findings registry. Use when a demo consuming @hyperfrontend/features surfaces an unclear API, confusing error, missing feature, docs gap, packaging snag, or DX papercut — file the finding before writing the workaround.
---

# Demo Findings

Demo-building is product feedback. Every rough edge consuming `@hyperfrontend/features` becomes a registry entry feeding the v2.

## Paths

| Role           | Path                                    |
| -------------- | --------------------------------------- |
| Registry index | `roadmap/showcase/findings/README.md`   |
| Findings       | `roadmap/showcase/findings/NNN-slug.md` |
| Declined       | `roadmap/showcase/findings/declined.md` |

## Gate

**Before writing any workaround for demo friction: file a finding.** The workaround goes in the demo; the friction goes in the registry. Write from a **normal external consumer's** viewpoint — assume no workspace or internal knowledge.

## File a finding

1. Next ID: highest `F-NNN` in the registry + 1.
2. Create `roadmap/showcase/findings/NNN-slug.md` from the template below.
3. Add a row to the open-findings table in `findings/README.md` — bootstrap the registry from the index template below if the file does not exist yet.

### Template

```markdown
# F-NNN — <one-line title from the consumer's mouth>

| Field        | Value                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Category     | api-friction \| missing-feature \| confusing-error \| docs-gap \| packaging \| dx-papercut \| other |
| Severity     | blocker \| high \| medium \| low                                                                    |
| Surfaced by  | <demo or context>                                                                                   |
| Status       | open                                                                                                |
| Disposition  | v2 \| docs \| api-refinement \| declined \| —                                                       |
| Graduated to | <link once triaged, else —>                                                                         |

## What happened

## Why it's friction (consumer lens)

## Proposed fix / improvement

## Repro / evidence
```

### Registry index template (`findings/README.md`, first use)

```markdown
# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

## Open

| ID  | Title | Category | Severity | Surfaced by | Status | Disposition |
| --- | ----- | -------- | -------- | ----------- | ------ | ----------- |

## Resolved

| ID  | Title | Resolution |
| --- | ----- | ---------- |

Declined findings move to [declined.md](declined.md) with a one-line reason.
```

## Categories

| Category          | Use when                                               |
| ----------------- | ------------------------------------------------------ |
| `api-friction`    | The API works but is awkward, surprising, or verbose   |
| `missing-feature` | A capability the consumer reasonably expects is absent |
| `confusing-error` | An error is unclear, mistimed, silent, or misleading   |
| `docs-gap`        | The answer is not in README/ARCHITECTURE/JSDoc         |
| `packaging`       | Install, exports, types, bundling, or bin resolution   |
| `dx-papercut`     | Small repeated annoyance in the dev loop               |
| `other`           | None of the above                                      |

## Severity

`blocker` (cannot ship the demo) · `high` (forces an ugly workaround) · `medium` (slows the consumer) · `low` (cosmetic / nice-to-have).

## Graduation

Triage sets `Status: triaged` and a `Disposition`, then links `Graduated to` (a v2 plan entry, a docs task, an api-refinement note, or `declined.md`). Decline = move the row to `declined.md` with a one-line reason.

## Checklist

- [ ] Filed before the workaround
- [ ] Written from the consumer's viewpoint
- [ ] Category + severity set
- [ ] Row added to `findings/README.md`
- [ ] Minimal repro/evidence included
