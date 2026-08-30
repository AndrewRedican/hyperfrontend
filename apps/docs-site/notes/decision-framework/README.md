# Microfrontend Decision Framework: Research Notes

What backs the fit assessment published at `/docs/is-hyperfrontend-right-for-you`. Nothing
here is shipped, built, rendered, or linted: it is the model the published dataset is
projected from, the evidence under that model, and the guard that catches the two drifting
apart. Research snapshot: August 2026.

## The two sides

| Side | Where |
| ------ | ------- |
| Published dataset | [../../src/data/decision-framework.ts](../../src/data/decision-framework.ts) |
| Engine and record builder | [../../src/lib/decision-engine.ts](../../src/lib/decision-engine.ts), [../../src/lib/decision-record.ts](../../src/lib/decision-record.ts) |
| Result diagrams | [../../src/components/decision/](../../src/components/decision/) and [../../src/lib/delivery-topology.ts](../../src/lib/delivery-topology.ts) over the answer-to-element table in [../../src/lib/delivery-topology-table.ts](../../src/lib/delivery-topology-table.ts), specified in [ux/result-diagrams-spec.md](ux/result-diagrams-spec.md) |
| Model (the authority) | [model/](model/) |
| Evidence under the model | [matrix/](matrix/), [research/](research/) |
| Drift guard | [matrix/check-projection.mjs](matrix/check-projection.mjs) |

The dataset is a hand-derived **projection** of the model, not a generated artifact. Nothing
keeps the two in step by construction, so the guard reports every divergence it can
establish mechanically and names the rest as UNCHECKED rather than passing it silently:

```
npm run check:decision-framework        # from apps/docs-site
```

Run it after any edit to either side. Exit 0 is no drift, 1 is drift, 2 means the guard could
not run. Its coverage and blind spots are section 7 of
[maintenance/versioning-strategy.md](maintenance/versioning-strategy.md).

## Map

| Area | Contents |
| ------ | ---------- |
| [MASTER.md](MASTER.md) | The requirements register (118 REQ ids) every artifact here answers to. |
| [BACKLOG.md](BACKLOG.md) | Known model defects, open questions, uncertainties. Read before trusting a result. |
| [model/](model/) | Taxonomy and the 12 latent dimensions, families, implementations, constraints, questions and the question graph, family coordinates, topology, migration, state transition, enterprise layer, canonical schema, engine semantics, LLM boundary. |
| [matrix/](matrix/) | 220 atomic attributes by 30 units, one evidence-carrying column file each, plus the assembler and the drift guard. |
| [research/](research/) | Landscape inventory with inclusion and exclusion rationale, one dossier per unit, the HyperFrontend thesis, community signals. |
| [scenarios/](scenarios/) | 8 hand-traced decision journeys held as regression fixtures. |
| [positioning/](positioning/) | Where HyperFrontend is and is not a fit, its adoption floor, market gaps. |
| [ux/](ux/) | Report design, the result-diagram specification, the visualization concepts that were considered. |
| [maintenance/](maintenance/) | Refresh cadence, versioning of research claims, guard coverage. |

## Conventions

- Every ecosystem claim is dated and carries evidence with a claim-type label: framework
  guarantee, browser guarantee, common pattern, possible extension, officially supported,
  community convention, inference. Never convert possible into supported, typically into
  required, or isolated into secure without stating the boundary.
- Concepts have stable dotted identifiers (`family.document-embedding`,
  `question.trust.malicious-participant`). Wording may change, identity may not.
- Link, do not repeat. Artifacts cite each other and MASTER REQ ids instead of restating.
- No em dashes.
- Neutrality is load-bearing: the framework must be able to recommend a competitor or no
  microfrontends at all, and [scenarios/](scenarios/) is where that is tested.

## What is not here

The process layer stayed out of the repository: the source conversation, the phase plan and
running state, the completeness audit, the two discovery sweeps, the docs-site capability
inventory taken before the interface existed, and the 1.4 MB assembled matrix. All of it was
scaffolding for work that is finished, and the assembled matrix comes back on demand from
[matrix/assemble.mjs](matrix/assemble.mjs). Where a document cited one of them, the citation
now states the fact instead of pointing at the file.
