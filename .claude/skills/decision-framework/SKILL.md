---
name: decision-framework
description: Change the microfrontend decision framework behind /docs/is-hyperfrontend-right-for-you - the research notes, the projected dataset, the engine, the result diagrams. Use when editing families, questions, answers, implementations, the comparison matrix, the hyperfrontend floor, or anything the fit assessment publishes.
---

# Decision Framework

A deterministic assessment: facts to constraints to families to implementations, no model in
the recommendation path. Two sides, one direction of travel.

## Paths

| Role              | Path                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| Model + evidence  | `apps/docs-site/notes/decision-framework/` (start at its README)          |
| Known defects     | `.../notes/decision-framework/BACKLOG.md`                                 |
| Published dataset | `apps/docs-site/src/data/decision-framework.ts`                           |
| Engine + record   | `apps/docs-site/src/lib/decision-engine.ts`, `decision-record.ts`         |
| Diagrams          | `apps/docs-site/src/components/decision/`, `src/lib/delivery-topology.ts` |
| Pages             | `apps/docs-site/src/app/docs/is-hyperfrontend-right-for-you/`             |
| Drift guard       | `.../notes/decision-framework/matrix/check-projection.mjs`                |

## Gate

**The dataset is a projection of the model, never the source.** A published value changes in
the model first, then in the dataset, then the guard runs:

```bash
cd apps/docs-site && npm run check:decision-framework   # 0 clean, 1 drift, 2 cannot run
npx vitest run src/lib/decision-engine.spec.ts
```

Exit 2 usually means the dataset literal stopped being plain JavaScript. The guard evaluates
it as data, so no `as`, no `satisfies`, no computed values inside `decisionFramework`.

## Recipes

- **Change a family, question, answer, implementation, or availability state.** Edit the
  owning model file (`model/families.md`, `questions.md`, `implementations.md`,
  `constraints.md`, `question-graph.md`), then mirror it in the dataset, then guard. A new
  question also needs its constraint binding and its graph edge, or it is unreachable.
- **Add or refresh a comparison unit.** Dossier from `research/solutions/TEMPLATE.md`, then a
  column in `matrix/columns/`, then `node assemble.mjs` to validate, then
  `node assemble.mjs --tsv matrix-compact.tsv` because the model quotes that projection, then
  update `research/landscape-inventory.md` and the snapshot date.
- **Fix a model defect.** Re-trace the affected fixtures in `scenarios/` and update
  `BACKLOG.md`. Never patch a fixture to make a trace pass: the fixture is the regression.
- **Change the plotted landscape.** Coordinates live in `model/family-coordinates.md` and are
  copied into each family's `position`. Overrides are declared there, not invented in the
  component.

## Invariants

- HyperFrontend must be able to lose. `scenarios/` proves it: one fixture ends in "no
  microfrontends", one in a competitor. Keep it that way.
- Dotted ids are stable identity. Rename the wording, never the id.
- Each question is asked once. The `Prompt` and `Technical note` bullets in
  `model/questions.md` are published verbatim and the guard compares them, so change model
  and dataset together. Keep the prompt naming a circumstance or a constraint, never a
  mechanism or a benefit (the anti-steering audit, `questions.md` 1.3).
- Every ecosystem claim is dated and labelled with its claim type. Never promote possible to
  supported, typically to required, or isolated to secure. `unknown` is an honest verdict.
- Claims are a snapshot (August 2026). Refreshing moves the snapshot rather than silently
  editing a claim.
- The notes are excluded from eslint and prettier so they stay as written. Keep them that
  way, no em dashes, links relative and resolving.
- The result route is `noindex` and listed in `SITEMAP_EXEMPT_ROUTES`; adding a route under
  the assessment means updating `scripts/validate-sitemap.ts`.

## Checklist

- [ ] Model changed before the dataset
- [ ] Guard exits 0, engine spec passes
- [ ] Scenario fixtures re-traced if a rule, scale, or elimination set moved
- [ ] Snapshot date and `metadata` counts still true
- [ ] BACKLOG.md updated if you found or fixed a defect
