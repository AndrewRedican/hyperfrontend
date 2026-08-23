# Guides verification

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[phase 1, guide markers](../phase-1-lib-consolidation.md#guide-extraction-markers)

## Goal

Prove the guides pipeline extracts truthfully against the final shape of every marked
source, and that every guide sentence around those snippets still tells the truth.

## Scope

The `compose-independent-features` guide extracts from files this plan refactored:

- `lib/src/contract/wire.ts` (`neighbors-handler`, moved in phase 1)
- `host/src/scene/koi-sessions.ts` (`shell-factories`, `open-shoal`; refactored to
  instances in phase 3)
- `host/src/scene/pond.ts` (`survive-close`, `retry-open`, `relay-fanout`; re-keyed in
  phase 3)
- `fish-vanilla/feature.config.ts` and `fish-vanilla/koi-fish.contract.ts` (0.8.0 bump)
- `host/src/hyperfrontend.feature.ts` (`outer-boundary`; deferred boot reshaped it)

The `detect-unresponsive-feature` guide extracts from the heartbeat demo only; untouched
by this plan, verify it stays green in the same run.

## Steps

1. Run the guides generator; every `snippetSources` region must resolve.
2. Read each extracted snippet as a stranger: does the surrounding `guide.md` prose
   still describe what the snippet now shows (instances rather than a fixed eight, the
   shared wire plumbing, the deferred open)? Adjust prose where reality moved;
   present-state wording only, no trajectory language, no em dashes (guardrails 1, 3).
3. Consider one addition, then decide: a marked region demonstrating `feature.hosted`
   at the pond's boot decision would be the first feature-side snippet in the guide
   family, and the deferred boot is its natural home. Add it only if the guide's
   narrative has a place for it; never force it.
4. Run the link checker; API deep links (`#api-` anchors) must resolve, including any
   new `hosted` references.
5. Guide `meta.json` `apis` entries: confirm `createFeature` still resolves against the
   regenerated TypeDoc output.

## Specs

None (pipeline verification; no doc test files, per standing policy: examples are run
on the fly against published packages, recorded with version and date, drift accepted).

## Documentation impact

- `guide.md` prose adjustments as found; `meta.json` re-points if any region moved
  again in phase 3.

## Verification

```bash
npx nx test docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
npx nx format:write --projects=docs-site
npx nx run docs-site:build
```
