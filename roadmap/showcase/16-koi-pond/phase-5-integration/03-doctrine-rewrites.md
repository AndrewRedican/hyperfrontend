# Doctrine rewrites

Part of [Phase 5](README.md) · Guardrails: [plan index](../README.md)

## Goal

Rewrite the two doctrine surfaces so shipped prose describes the shipped pond, in
timeless present-state language. This is the sub-plan where guardrail 1 carries the most
weight: the temptation to narrate the change ("the brain now lives in the lib") must be
resisted everywhere; the reader gets only what is.

## Files

- `apps/demos/koi-pond/README.md`
- `.claude/skills/koi-pond-demo/SKILL.md`

## The pond README

The old thesis ("the shared library is a vocabulary, never a simulation engine; each
fish composes those primitives into its own swimming brain") is retired. The new thesis,
written as if it were always so:

- Eight frameworks each own their **mounting, rendering, and lifecycle idiom** around
  one shared, hook-configurable simulation. The proof is the seam: the same brain and
  runtime, observed and biased through typed hooks, expressed by eight genuinely
  different component layers (react roots and refs, solid signals, vue SFCs, svelte
  runes, lit shadow DOM with a `ReactiveController`, angular zoneless mounts, preact,
  hand-rolled DOM).
- The **dynamic shoal is the host-control proof**: visitors compose and recompose the
  running system (add, remove, duplicate across frameworks) and the host orchestrates
  sessions, identity, and depth live.
- Card and full scenes as first-class profiles; hosted/standalone behavior; the tier
  cap as capability adaptation.

Sections to touch beyond the thesis: the architecture overview (lib module list grows
motion/runtime/wire/stage), the fish-app description (what an app is: the idiomatic
layer), and any sentence claiming per-fish brains. Sweep the whole file; the doctrine
statement is repeated in more than one place today.

## The koi skill

Refresh the operational facts to the final shape: the instance model and
`KoiInstanceId`; trio boot and the tier cap (4/8/12); the unified shoal panel; the
monochrome overlay grammar (cones, pearls, caret); `resting`; deferred boot and the
`hosted` signal; release-GL-on-hidden; the 0.8.0 repack pipeline (including the 0.7.0
tarball pruning); the vitals additions; and the supersession note for the 2026-08-09
single-session expand decision (the skill's decision log is the right home for
supersessions; shipped READMEs are not). The shipped shape of the panel, the overlay
grammar, and the vitals additions is recorded in
[phase 4](../phase-4-chrome-and-overlay.md).

## Method

- Write both files fresh against the final code, not by patching sentences: doctrine
  prose degrades under incremental edits.
- Then sweep: grep the em dash character across both files (guardrail 3); grep for
  trajectory words ("now", "new", "no longer", "previously", "moved", "used to") and
  rewrite any hit that narrates change rather than state; confirm neither file
  references plans, phases, or this folder (guardrail 1).
- Fish-app and demo READMEs: read `apps/demos/koi-pond/README.md` neighbors (clock,
  heartbeat) only for the standalone-claims check from
  [the `hosted` signal](../phase-2-isolated-improvements.md#the-hosted-signal); they
  need no koi-driven changes. Its vocabulary trap governs this rewrite: `hosted: false`
  is never called "standalone".

## Specs

None (prose).

## Documentation impact

This sub-plan **is** the documentation impact; nothing else ships prose in phase 5
beyond the guide adjustments in [02](02-guides-verification.md).

## Verification

```bash
npx nx lint demo-koi-pond --fix
npx nx format:write --projects=demo-koi-pond
```

Plus the greps above; the skill file has no lint surface, review it by eye.
