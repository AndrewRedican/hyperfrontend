# Phase 1: Foundation (demo-koi-lib consolidation, motion retune, contract 0.8.0)

Grow `demo-koi-lib` into the single home of the shared koi simulation so every later phase
edits one place instead of eight. Everything here is **additive to the lib**: the fish apps
keep their local copies until [phase 3](../phase-3-instance-model/05-fish-migration.md), so
nothing on `main` contradicts shipped prose during this phase.

Evidence: [recon §1](../recon.md#1-duplication-across-the-eight-fish-apps) (what is
duplicated, what stays idiomatic, the drift already caught) and
[recon §4](../recon.md#4-a-container-derived-card-world) (the card-world geometry).
Decisions and guardrails: [plan index](../README.md).

## Sub-plans, in execution order

| #   | Sub-plan                                                 | Depends on |
| --- | -------------------------------------------------------- | ---------- |
| 01  | [Motion brain port](01-motion-port.md)                   | none       |
| 02  | [Motion retune](02-motion-retune.md)                     | 01         |
| 03  | [Predicted path](03-predicted-path.md)                   | 01         |
| 04  | [Contract 0.8.0 and wire plumbing](04-contract-0-8-0.md) | none       |
| 05  | [Runtime loop](05-runtime.md)                            | 01, 04     |
| 06  | [Variant seeds](06-variant-seeds.md)                     | none       |
| 07  | [Frame-derived world](07-frame-world.md)                 | 06         |
| 08  | [Three.js stage](08-stage.md)                            | none       |
| 09  | [Card anchor](09-card-anchor.md)                         | none       |
| 10  | [fish.css export](10-fish-css.md)                        | none       |
| 11  | [Guide extraction markers](11-guide-markers.md)          | 04         |

01/04/06/08/09/10 are mutually independent and can interleave. The retune (02) lands only
after the port (01) proves behavior parity, so behavior changes are never entangled with
the move itself.

## Iteration surface

Use the workbench for visual iteration: `npx nx run demo-koi-workbench:dev` serves on
`:4283` and aliases the lib to `lib/src`, so motion and stage changes are live without a
repack.

## Spec obligations

Fish apps carry no tests by design; every module that lands here inherits the lib's spec
obligations. Each sub-plan states its own specs, and the retune specs must be
mutation-proven (disable the behavior, watch the named spec fail).

## Phase gate

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
npx nx run demo-koi-lib:build && npx nx run demo-koi-lib:refresh && npx nx run demo-koi-lib:verify
```

The refresh/verify pair repacks the committed `file:` tarball and proves consumers resolve
it; a bare `npm install` no-ops on same-version repacks.

## Documentation impact (phase rollup)

- New lib modules get JSDoc in the established house style; all prose present-state
  ([guardrail 1](../README.md#guardrails-single-source-every-sub-plan-links-here)).
- No package README, guide, or skill changes in this phase, with one exception: the guide
  snippet re-point in [11-guide-markers.md](11-guide-markers.md), which must land in the
  same change as the wire-plumbing move it follows.
