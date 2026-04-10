---
name: implementation-plans
version: 1.0.0
description: Create rigorous implementation plans documenting what to change, where, and why. Use when planning features, writing roadmap documents, or scoping multi-step refactors. Produces phased plans with verification checkpoints and complete file listings.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Terminal
  - Subagent
---

# Implementation Plans

Phased plans with complete file discovery and verification commands.

## Reference Locations

| What         | Where                            |
| ------------ | -------------------------------- |
| Plans        | `roadmap/*.md`                   |
| Coding skill | `.github/skills/coding/SKILL.md` |

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
npx nx test PROJECT
npx nx lint PROJECT --fix
npx nx typecheck PROJECT
npx nx format:write --projects=PROJECT
```

Fix all IDE-reported errors before proceeding.

---

## Implementation

**MUST** read coding skill before implementing any code.

---

## Checklist

- [ ] All unknowns resolved before plan written
- [ ] Phases ordered: foundation → core → integration
- [ ] Each phase independently verifiable
- [ ] File paths complete and accurate
- [ ] Unit tests included only if project has existing `*.spec.ts`
- [ ] Verification commands use correct `npx nx` syntax
- [ ] Plan saved to `roadmap/*.md`
