# Backlog

Last reviewed: 2026-08-29. What is known to be wrong, unresolved, or unverified. The model
is published behind a live assessment, so this file is the honest counterweight to it. Read
it before treating a result as authoritative.

## Model defects

Found by hand-tracing the 8 fixtures in [scenarios/](scenarios/) through the model. No
fixture was patched to make a trace pass (REQ-ORCH-11); each carries a "Model findings"
section instead. Most serious first.

1. **Regression.** [scenarios/should-not-use-microfrontends.md](scenarios/should-not-use-microfrontends.md)
   computes `trust.other-oss` where its own guardrail pins `trust.no-mfe`. A fixture whose
   whole point is that the framework can say "do not do this" does not currently say it.
2. **Blocking.** The greenfield state fork routes every greenfield answer to `state.target`,
   leaving `bestToday` with no hard binding
   ([scenarios/coordinated-greenfield-platform.md](scenarios/coordinated-greenfield-platform.md)).
3. `constraint.seamless-ux` has no deciding atom outside `granularity.region`, so families
   score `na` on it and outrank families that genuinely satisfy it. Three fixtures hit this.
4. `engine.rule.candidate-order` has no boundary-strength term, so ties resolve by
   lexicographic id ([model/decision-engine.md](model/decision-engine.md)).
5. `question.trust.malicious-participant` is unreachable from an acquisition path
   ([model/question-graph.md](model/question-graph.md)).
6. Disposition follow-ups from ranks 14 and 16: correct the Max G1 cell in the
   [model/questions.md](model/questions.md) rank index, move the `constraint.paved-road`
   limb into section 5.6 of [model/constraints.md](model/constraints.md), and resolve the
   `family.islands` pole list in [model/taxonomy.md](model/taxonomy.md) 2.11, which blocks
   one rank-16 elimination.

## Open questions

- Whether `family.lifecycle-orchestration` and `family.module-graph-federation` should stay
  separate families. They collide on both plot axes and on the depth channel, and are
  routinely stacked in practice ([model/family-coordinates.md](model/family-coordinates.md)
  section 7).
- Two coordinate overrides were required to keep the landscape legible and are flagged in
  [model/family-coordinates.md](model/family-coordinates.md) section 6.

## Known uncertainties

- 178 of the 6600 matrix verdicts are `unknown`. They are honest gaps, each a candidate for
  the next refresh, not defects.
- Two families (`family.lifecycle-orchestration`, `family.virtualized-rehosting`) stay
  concept-coherent under the removal test, but every matrix column evidencing them is a
  branded one. The re-verification duty is recorded in
  [model/families.md](model/families.md) section 8.

## Standing decisions

- **D-003** The research snapshot is fixed at August 2026. Every ecosystem claim is dated
  against it; a refresh moves the snapshot, it does not silently update claims.
- **D-004** Family dossiers live inside [model/families.md](model/families.md) rather than as
  separate per-strategy files.
- **D-005** The docs-site dataset is a projection guarded by
  [matrix/check-projection.mjs](matrix/check-projection.mjs) rather than generated from the
  model. Revisited when the canonical collections in
  [model/schema-proposal.md](model/schema-proposal.md) exist.

## Next work, in order

1. The two defects above that are marked regression and blocking.
2. Build the canonical collections from
   [model/schema-proposal.md](model/schema-proposal.md) so the dataset is generated rather
   than projected, retiring the guard's UNCHECKED categories.
3. The remaining defects, then the open questions.
