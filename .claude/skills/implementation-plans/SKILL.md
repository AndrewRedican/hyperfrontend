---
name: implementation-plans
description: Create rigorous implementation plans documenting what to change, where, and why. Use when planning features, writing roadmap documents, or scoping multi-step refactors. Produces phased plans with verification checkpoints and complete file listings.
---

# Implementation Plans

Phased plans with complete file discovery and verification commands.

## Reference Locations

| What         | Where                            |
| ------------ | -------------------------------- |
| Plans        | `roadmap/*.md`                   |
| Coding skill | `.claude/skills/coding/SKILL.md` |

---

## Pre-Action Gate

**Resolve all unknowns before writing.** Ask human for decision-requiring unknowns.

---

## Plan Structure

- **Context** – 1-3 sentences: problem + solution
- **Phase N** – one per logical grouping (see ordering below)

No summary at end.

---

## Phase Ordering

| Order | Phase       | Contains                                 |
| ----- | ----------- | ---------------------------------------- |
| 1     | Foundation  | Types, utilities other changes depend on |
| 2     | Isolated    | Self-contained improvements (low risk)   |
| 3     | Core        | Primary feature/refactor                 |
| 4     | Integration | Connect components, update consumers     |

Each phase **MUST** be independently verifiable.

---

## Verification Commands

Insert after each phase. Replace `PROJECT` with actual project name:

```bash
npm run hf -- run PROJECT:test
npm run hf -- run PROJECT:lint --fix
npm run hf -- run PROJECT:typecheck
npm run hf -- format --write
```

Fix all IDE-reported errors before proceeding.

---

## Implementation

**MUST** read coding skill before implementing any code.

## Living Plans

A plan under `roadmap/` describes what is still to do. When a milestone lands, delete its section and keep only what the remaining milestones build on (a short "what exists" list, decisions that changed). Never add progress notes, status logs or in-between findings unless the owner asks; the plan is not a journal. Plans stay uncommitted until the owner asks to commit them.

---

## Checklist

- [ ] All unknowns resolved before plan written
- [ ] Phases ordered: foundation → core → integration
- [ ] Each phase independently verifiable
- [ ] File paths complete and accurate
- [ ] Unit tests included only if project has existing `*.spec.ts`
- [ ] Verification commands use the `npm run hf --` syntax
- [ ] Plan saved to `roadmap/*.md`
