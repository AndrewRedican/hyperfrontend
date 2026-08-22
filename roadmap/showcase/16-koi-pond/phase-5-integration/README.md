# Phase 5: Integration (gallery choreography, guides, doctrine)

The outer world catches up with the new pond: the docs-site swaps instances on expand,
the guides stay true, the doctrine prose is rewritten against the final shape, findings
graduate, and the plan's original victim device signs off.

Depends on [phases 3 and 4](../phase-3-instance-model/README.md); phases 3, 4, and 5
land on `main` in the same release cycle
([why](../phase-3-instance-model/README.md#doctrine-coherence)). Decisions and
guardrails: [plan index](../README.md).

## Sub-plans, in execution order

| #   | Sub-plan                                         | Depends on                   |
| --- | ------------------------------------------------ | ---------------------------- |
| 01  | [Expand choreography](01-expand-choreography.md) | phase 3                      |
| 02  | [Guides verification](02-guides-verification.md) | 01, phase 1 item 11          |
| 03  | [Doctrine rewrites](03-doctrine-rewrites.md)     | phases 3 and 4 final shape   |
| 04  | [Findings](04-findings.md)                       | everything surfaced en route |
| 05  | [Device acceptance](05-device-acceptance.md)     | the deployed result          |

## Phase gate

```bash
npx nx run-many -t test lint typecheck -p docs-site
npx nx run docs-site:build
```

Plus one full koi family gate rerun (the command block in the
[plan index](../README.md#verification-conventions)), and the
[device acceptance checklist](05-device-acceptance.md) on the physical phone.

## Documentation impact (phase rollup)

This phase is where nearly all shipped prose changes: the pond README thesis, the koi
skill, the guide snippet truthfulness. Every word present-state, no trajectory language,
no em dashes in README/guide/JSDoc surfaces (guardrails 1 and 3); grep for the em dash
character across every touched doc before finishing.
