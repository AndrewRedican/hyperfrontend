# Phase 4: Chrome and overlay redesign (demo-koi-pond)

The visitor-facing layer over the instance model: the roster becomes the interactive
shoal panel, and the interaction overlay's color-coded grammar is fully replaced by the
monochrome grammar (gradient cones, pearl trace, sliding caret).

Depends on [phase 3](../phase-3-instance-model.md) (shipped: instances, dynamic shoal) and
[phase 1](../phase-1-lib-consolidation.md#predicted-path) (the path on the outline).
Decisions and guardrails: [plan index](../README.md).

## Sub-plans, in execution order

| #   | Sub-plan                                                 | Depends on                            |
| --- | -------------------------------------------------------- | ------------------------------------- |
| 01  | [Unified shoal panel](01-shoal-panel.md)                 | phase 3 items 01, 02                  |
| 02  | [Gradient cone](02-gradient-cone.md)                     | none within this phase                |
| 03  | [Pearl trace](03-pearl-trace.md)                         | phase 1 predicted path via the repack |
| 04  | [Sliding caret and grammar removal](04-sliding-caret.md) | 02, 03                                |
| 05  | [Vitals updates](05-vitals-updates.md)                   | phase 3 items 01, 02                  |

02 and 03 are independent of each other; 04 lands last within the overlay because it
deletes the old grammar, and the deletion must not precede its replacements.

## Phase gate

```bash
npx nx run-many -t test build lint typecheck -p demo-koi-pond
```

Browser (composed build, overlay on): head-anchored gradient cones that never detach from
the fish; pearl traces that the fish visibly swims through; the caret sliding around the
head ahead of each turn; no color-coded rays anywhere; panel add/remove flows fully
operable by keyboard; panel collapses to a pill under 680px and stays usable.

## Documentation impact (phase rollup)

None shipped in this phase; the koi skill's overlay and controls description is rewritten
in [phase 5](../phase-5-integration/03-doctrine-rewrites.md) against the final grammar.
