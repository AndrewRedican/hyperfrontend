# Motion brain port

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §1](../recon.md#1-duplication-across-the-eight-fish-apps)

## Goal

Move the koi steering brain into the lib as `createKoiMotion(profile, options?)`, byte-true
in behavior, with the hook seams the locked doctrine requires ("lib owns body + physics +
brain; brain configurable via init and runtime hooks"). This sub-plan is the **port only**;
behavior changes are [02-motion-retune.md](02-motion-retune.md).

## Files

- New: `apps/demos/koi-pond/lib/src/motion/koi-motion.ts` (plus `motion/index.ts`, exported
  from the lib root index; the module is renderer-free, so it belongs in the root export
  beside `model` and `geometry`, not a new subpath).
- Source of the port: `apps/demos/koi-pond/fish-vanilla/src/koi/koi-motion.ts` (664 loc).
- New specs: `apps/demos/koi-pond/lib/src/motion/__tests__/koi-motion.spec.ts`.

## Design

- **Canonical source.** Seven brains are byte-identical modulo comments; adopt the
  `fish-react` variant as canonical because it already carries the two cosmetic
  improvements the others drifted toward (`DEPTH_ROLL_S` hoisted as a named const, the
  `REDUCED_MOTION_DAMPING` ordering). Zero algorithm or constant changes.
- **API.** `createKoiMotion(profile, options?)` where `options` adds:
  - init configuration: the trim/physical overrides the fish already derive from traits;
  - minimal typed runtime hooks, defaulting to no-ops: a decision-commit observer
    (called when the brain commits a turn/escape/depth decision) and an optional desire
    override (lets a consumer bias the desire ladder without forking the brain).
    Hooks are the doctrine seam: framework apps stay able to observe and bias the shared
    brain without owning a copy of it.
- **Header rewrite.** The per-fish header ("It composes the shared steering verbs into
  _this_ fish's judgement... nothing in here belongs in the shared lib") must not survive
  the port in any form. Write a present-state header: a hook-configurable steering brain
  shared by every koi; consumers observe and bias it through the options. No references to
  the migration or to what the file used to be
  ([guardrail 1](../README.md#guardrails-single-source-every-sub-plan-links-here)).
- **Seed discipline.** The brain consumes the seeded RNG it is given; nothing in the port
  touches `KOI_FRAMEWORKS` order or trait band order (guardrail 4).

## Specs

- Deterministic parity run: seed a profile, advance N simulated seconds, snapshot the state
  trajectory; the ported brain must reproduce the pre-port trajectory exactly (capture the
  golden trace from the vanilla copy before deleting anything; the copies remain in the
  fish apps until phase 3, so the trace can be regenerated at will during this phase).
- Hook contract: no-op defaults change nothing (same golden trace); the decision observer
  fires on committed decisions with the documented payload; the desire override is applied
  when provided.
- Reduced-motion profile still damps as before.

## Documentation impact

- JSDoc on `createKoiMotion`, the profile type, and both hooks, in the house style
  (one-sentence summary, `@param name - Sentence.`, titled `@example`). Present-state only.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
