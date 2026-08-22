# Motion retune

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[01-motion-port.md](01-motion-port.md)

## Goal

Land the four locked behavior changes once, in the lib brain, instead of eight times. Each
change is mutation-proven: disabling it must fail a named spec.

## Files

- `apps/demos/koi-pond/lib/src/motion/koi-motion.ts`
- `apps/demos/koi-pond/lib/src/motion/__tests__/koi-motion.spec.ts` (extend)

## Design

### 1. Turn tiers

Classify each avoidance maneuver by obstacle proximity into subtle / normal / hard bands,
with thresholds expressed as named time-to-encounter constants. Resolution always picks the
**least-effort tier that clears the obstacle**: try subtle first, escalate only when the
predicted clearance fails. A distant crossing produces a lazy arc; only a genuinely close
obstacle produces the hard tier.

### 2. Global turn-magnitude cap

Scale the existing `TURN_RATE` ceilings and the escape gain path by a named constant
(0.8). Nothing may command a turn rate above 80 percent of the current ceilings, escapes
included.

### 3. Maneuver slowdown

Reduce the speed target proportionally to the commanded turn magnitude so hard turns brake
visibly; this removes the drifty look where a koi corners at cruise speed. `TURN_SPEED_TAX`
must be re-derived together with the brake so the pair does not double-count: decide which
component owns passive drag and which owns commanded braking, and document that split in
the constants' comments (present-state, prefixed single-line comments; guardrail 2).

### 4. Avoidance side choice

- When the obstacle field is asymmetric, turn toward the clearer side.
- When evidence is equal, apply a seeded 70/30 right bias, deterministic per encounter via
  the existing seeded RNG, so a head-on pair both break right and clear each other.
- The encounter-memory side latch stays: once a side is chosen for an encounter it holds,
  preventing oscillation.

## Specs (mutation-proven)

- **Head-on spec:** two mirrored koi on a collision course both break right and clear
  without oscillation. Disable the right bias, this spec fails.
- **Braking spec:** a hard-tier turn produces a speed target measurably below cruise.
  Disable the proportional brake, this spec fails.
- **Tier spec:** a near obstacle classifies hard, a distant one subtle; the resolver picks
  the least tier that clears.
- **Cap spec:** across a seeded fuzz of encounters, no commanded turn rate exceeds 0.8
  times the pre-retune ceiling.
- Determinism: identical seeds produce identical decisions (bias included).

## Visual acceptance

On the workbench (`npx nx run demo-koi-workbench:dev`, port 4283, lib aliased to source):
hard turns visibly brake; a staged head-on pair breaks right; no fish whips faster than
before; escapes still read as escapes at 80 percent magnitude.

## Documentation impact

- Constants gain `// why:` single-line comments stating the invariant they encode (least
  effort, no double-counted braking), never their history.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
