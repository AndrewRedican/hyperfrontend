# Fish migration

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[phase 1](../phase-1-lib-consolidation/README.md) complete · Evidence:
[recon §1](../recon.md#1-duplication-across-the-eight-fish-apps)

## Goal

All eight fish apps drop their local copies of the shared logic and compose the lib
primitives, keeping only the genuinely idiomatic component and mount layer (300 to 450
loc per app, the layer that is the demo's reason to exist).

## Per-app change shape

Every app: delete `koi/koi-motion.ts`, `runtime/koi-runtime.ts`,
`feature/wire-contract.ts`, the stage code, the card-anchor copy, and (for seven)
`styles/fish.css`; import `createKoiMotion`, `createKoiRuntime`, `wireKoiContract`,
`createKoiStage`, `cardAnchor`, and `@hyperfrontend/demo-koi-lib/fish.css`; bump
`feature.config.ts` to contract 0.8.0. The deleted brains' stale headers ("the other six
koi") go with them; nothing replaces them.

What each app keeps (the thesis layer):

| App     | Keeps                                                                          |
| ------- | ------------------------------------------------------------------------------ |
| vanilla | direct-DOM renderer and mount (`koi-render.ts` composition)                    |
| react   | `createRoot` + `StrictMode` + refs component (`KoiFish.tsx`)                   |
| preact  | `render` + class-attr component                                                |
| solid   | signal-driven component (card rows react through signals)                      |
| vue     | SFC + `createApp` + onReady handshake (`KoiFish.vue`)                          |
| svelte  | runes + `flushSync` stage component (`KoiStage.svelte`)                        |
| lit     | `LitElement` + shadow styles + a `ReactiveController` wrapping the lib runtime |
| angular | zoneless `createComponent`/`setInput` mount                                    |

- The hosted fact reaches the runtime as an argument from the SDK handle
  (`feature.hosted`), deleting each app's `window.parent` sniff in `originRelation()`
  ([phase 2 item 01](../phase-2-isolated-improvements/01-lib-features-hosted.md) is the
  enabler).
- Lit deliberately remains the proof that the runtime seam supports an idiomatic wrapper:
  its `ReactiveController` composes `createKoiRuntime` rather than reimplementing it.
- Fish apps stay test-free (guardrail 10); every migrated behavior is already covered by
  the lib suites from phase 1.

## Order

Migrate vanilla first (it is the guide-marker donor and the simplest), verify it against
the composed build, then fan out to the other seven. One project per commit (guardrail 5).

## Specs

- None in the fish apps (by design). The lib suites plus each app's typecheck/lint/build
  are the gates, and the composed-site browser checks in the
  [phase gate](README.md#phase-gate) are the behavioral proof.

## Documentation impact

- The pond README's doctrine sentence becomes false here; the rewrite is
  [phase 5](../phase-5-integration/03-doctrine-rewrites.md) and must ship in the same
  release cycle (see the [phase README](README.md#doctrine-coherence)).
- Deleted files take their headers with them; surviving app code gets no new prose beyond
  present-state comments.

## Verification

```bash
npx nx run-many -t test build lint typecheck -p demo-koi-fish-vanilla demo-koi-fish-react demo-koi-fish-vue demo-koi-fish-svelte demo-koi-fish-solid demo-koi-fish-preact demo-koi-fish-lit demo-koi-fish-angular
npx nx format:write --projects=demo-koi-fish-vanilla,demo-koi-fish-react,demo-koi-fish-vue,demo-koi-fish-svelte,demo-koi-fish-solid,demo-koi-fish-preact,demo-koi-fish-lit,demo-koi-fish-angular
```
