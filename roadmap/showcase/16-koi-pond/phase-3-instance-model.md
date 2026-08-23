# Phase 3: Core (shipped)

All six sub-plans shipped by 2026-08-23 and their documents were collapsed into this
record; what remains here is only the residue phases 4 and 5 build against. The host
keys everything session-shaped by instance, the shoal grows and shrinks at a visitor's
hand under a device-tier cap, boot is deferred behind the scene decision, the card is
its own one-fish resting profile, all eight fish compose the consolidated lib, and the
whole family speaks contract 0.8.0 in the composed build.

## What shipped

| Delivered                                            | Where it lives                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Instance keying end to end                           | `host/src/scene/instance-id.ts`, adopted by every scene module              |
| Dynamic shoal: add, remove, cap, roster state        | `host/src/scene/pond.ts` (`addKoi`/`removeKoi`/`shoalState`)                |
| Deferred boot and the scene decision                 | `host/src/feature/wire-contract.ts` (`wireSceneBoot`), `pond.ts` `setScale` |
| Card and full profiles                               | `pond.ts` (`openProfile`, the resting hold)                                 |
| Variant-seed adoption (twins as distinct animals)    | `lib/src/runtime/koi-runtime.ts` (`adopt`)                                  |
| Eight fish composing the lib                         | `fish-*/src` (idiomatic thesis layers only)                                 |
| 0.8.0 shells vendored, 0.7.0 pruned                  | `host/vendor/hyperfrontend-demo-koi-fish-*-shell-0.8.0.tgz`                 |
| `@hyperfrontend/features` 0.8.0 released and adopted | published 2026-08-23; host and all eight fish pin it                        |

The pond harness (`host/src/scene/__tests__/pond.spec.ts`: faked shells, hand-driven
clock, pointer events against relayed outlines) is where the shoal, boot, and profile
behaviour is specified; the [phase 4](phase-4-chrome-and-overlay.md) panel and vitals
specs extend it.

## Doctrine coherence

Phases 3, 4, and 5 land on `main` in the same release cycle. Two things are
transitionally untrue in-tree until [phase 5](phase-5-integration/README.md) ships:

- The pond README's standing doctrine sentence ("never a simulation engine") is false;
  the rewrite is [03-doctrine-rewrites](phase-5-integration/03-doctrine-rewrites.md).
- The gallery's in-place expand still sends `set-scene 'full'` to a card-decided pond;
  the pond diagnoses and ignores it (`scene:ignored`), so the expanded overlay shows
  the card scene until [01-expand-choreography](phase-5-integration/01-expand-choreography.md)
  swaps instances instead.

Do not merge this work to `main` in a cycle that will not also carry phases 4 and 5.

## The instance model

Facts the [phase 4](phase-4-chrome-and-overlay.md) panel and vitals display build on:

- `KoiInstanceId` is the branded string `framework:ordinal`
  (`host/src/scene/instance-id.ts`: `koiInstanceId`, `instanceFramework`,
  `instanceOrdinal`, `nextOrdinal`); the wire never sees it, the host converts at the
  channel boundary.
- Layers carry `data-fish` (framework, for styling) and `data-instance` (the id);
  they are raised and torn down with the roster (`stage.ts` `addLayer`/`removeLayer`).
- Roster rows were left per framework here, lit while **any** instance of that framework
  answers; per-instance rows, count badges, presence, and the cap state came with the
  [phase 4 panel](phase-4-chrome-and-overlay.md#the-shoal-panel).
- The vitals overlay already keys probe rows by instance (rows follow
  `.koi-layer[data-instance]`, appearing and disappearing with churn); the
  [phase 4 vitals work](phase-4-chrome-and-overlay.md#the-vitals-overlay) was display
  only: labels, the tier boot record, roster-change log lines.
- The depth spread re-deals from the live roster on every join and leave
  (`depth-director.ts`); a lone koi holds the surface at full scale and light, and a
  roster past seven doubles levels up.
- The relay excludes self by instance, never by framework, which is what makes twins
  avoid each other; resurrection budgets, retries, sequence tracking, and held chrome
  are all per instance.

## The shoal handle

The API the [phase 4 panel](phase-4-chrome-and-overlay.md#the-shoal-panel) wires to, on
`PondSceneHandle` (`pond.ts`):

- `addKoi(framework)` returns the new `KoiInstanceId`, or `null` at the cap with
  `onDiagnostic(null, 'shoal:refused', '<tier>-tier device seats <cap>')`. The newcomer
  takes its framework's lowest free ordinal.
- `removeKoi(id)` returns `false` for an unknown id or the last fish
  (`'shoal:refused', 'the pond is never empty'`). Removal closes politely first and
  tears the layer down on the close or after a 4s grace; a leaving instance's ordinal
  stays spoken for until its layer is gone; pending revives and retries die with it.
  A re-added ordinal reproduces its phenotype (the variant seed is a pure function).
- `shoalState()` returns `{ tier, cap, roster: [{ id, framework, ordinal }] }`; the
  device profile is read once at construction (`runtime/device-tier.ts`, caps 4/8/12).
- The outer shoal report stays `{connected, expected}` with `expected` the live roster
  size; the gallery contract is untouched.
- While `?vitals=1` is armed the handle also sits on `window.koiPond`, which is how a
  device-evidence session drives add/remove from the console; the panel supersedes it
  for visitors.

## The boot decision

Residue for the [phase 5 choreography](phase-5-integration/01-expand-choreography.md):

- `wireSceneBoot(link, scene, { hosted })`: unhosted opens the full profile in the same
  tick as boot; hosted holds the water empty until the first `set-scene` (routed by
  `wirePondContract` into `setScale`, which is the decision), a presentation in any
  mode but `embedded` reads as full immediately, and a host that never sends scene
  semantics forfeits at `SCENE_FALLBACK_MS` (1s).
- The scene decides exactly once and instances never morph: a later contradicting
  `set-scene` is diagnosed (`scene:ignored`) and changes nothing, roster and visuals
  alike. The choreography's cold-opened replacement instance decides its own scene
  through the same first `set-scene`; no new wire semantics are needed.
- `hosted` comes from the SDK handle (`feature.hosted`, features 0.8.0); the pond keeps
  its doctrine of no URL params and no `window.parent`.
- For [04-findings](phase-5-integration/04-findings.md): the boot-hint question stayed
  mild in practice. The fallback deadline is exercised only by a host that never speaks
  scene semantics, and the non-embedded presentation shortcut removes the wait for
  dialog and popup mounts; a host-declared boot hint on `Present` would remove the
  deadline entirely. File at phase 5's discretion.

## Card and full profiles

- Card: exactly one koi, `KOI_FRAMEWORKS[hour % 8]` at ordinal 0, in a world derived
  from the frame itself (`describePondForFrame(root.clientWidth, root.clientHeight)`),
  held resting (`pause {paused: true, resting: true}`) from open. Releasing a held card
  koi returns it to the resting hold, never to travel. The hour is decided at boot; a
  card never swaps fish mid-mount.
- Full: the hour-anchored trio (`hour`, `+1`, `+2` mod 8, all ordinal 0) in the
  screen-derived world, so an expand reads as the same koi with company.
- The curtain rule, the DPR floor cap, and the solo-at-surface depth all inherit from
  the machinery above with no profile-specific work.

## Variant seeds

The lib's `adopt()` rebuilds profile, brain, and renderer around a dealt seed that
differs from its canonical assumption, and re-stations the fish via
`entryStation(pond, koiSeed(framework), instance)`; twins are the same species in the
same colours wearing different bodies. This closed a phase-1 gap (the runtime had
consumed `identity.instance` only for wake stagger); the koi-runtime spec carries the
obligation. The [device checklist](phase-5-integration/05-device-acceptance.md) item on
duplicates leans on it.

## The migration shape

Facts the [doctrine rewrite](phase-5-integration/03-doctrine-rewrites.md) describes:

- Every fish composes `createKoiRuntime`, `createKoiStage`, `wireKoiContract`, and the
  lib `fish.css`; only the framework-idiomatic component and mount layer remains per
  app (react roots and refs, solid signals, vue SFC, svelte runes, preact, angular
  zoneless mounts, vanilla DOM).
- The runtime self-wires from `init.link`, so each app creates its feature handle
  first and passes `hosted: feature.hosted`; no `window.parent` or `document.referrer`
  sniff survives anywhere.
- Renderer factories are re-invoked on every wake from sleep and disposed on every
  stand-down; every renderer is fully rebuildable and its dispose clears everything it
  mounted.
- Lit composes the runtime through a `ReactiveController`
  (`fish-lit/src/koi/koi-swim-controller.ts`), the deliberate proof the runtime seam
  supports an idiomatic wrapper; lit also keeps its shadow styles, because the lib
  sheet is light-DOM and targets `#app`.
- Fish apps remain test-free; the lib suites carry every migrated behaviour
  obligation.

## The repack

The pipeline as run, for the [koi skill's refresh](phase-5-integration/03-doctrine-rewrites.md):

1. `demo-koi-lib:refresh` then `:verify` (the committed tarball feeds every consumer).
2. Fish `feature.config.ts` versions to 0.8.0 (each migration commit carried its own).
3. `demo-koi-pond:refresh-fish-shells` packs all eight and copies to `host/vendor/`,
   but never prunes.
4. Hand-delete the stale-version tarballs from **both** `host/vendor/` and
   `dist/apps/demos/koi-pond/fish-shell/*/`.
5. Re-run `host/scripts/install-vendored-shells.mjs` (the explicit-path install is the
   only invocation that re-reads a same-name tarball).
6. Commit tarballs, `package.json`, and the lockfile together. All builds serial; never
   overlap two builds of one project.

## What the gate verified, and what remains

The family gate (test, build, lint, typecheck across all ten koi projects) is green;
guides extraction is green with the full marker inventory intact (`shell-factories` and
`open-shoal` in `koi-sessions.ts`, `survive-close`/`retry-open`/`relay-fanout` in
`pond.ts`, the fish-vanilla and lib markers unchanged). Composed-build browser checks
under SwiftShader confirmed: the trio open at `domcontentloaded` with `hosted` false,
the tier-cap refusal diagnosed with the tier named, twins with measurably different
bodies, removal tearing the layer down, the never-empty guard, and the solo koi at the
surface z-index. Unit-proven but deliberately left for the
[phase 5 device acceptance](phase-5-integration/05-device-acceptance.md): the card boot
behind a real host, hide/show context release and staggered rebuild, the per-instance
kill-heal cycle, and the staged head-on pair.
