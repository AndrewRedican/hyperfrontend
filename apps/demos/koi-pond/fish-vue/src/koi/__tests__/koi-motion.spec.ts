import type { KoiMotion } from '../koi-motion'
import type { NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { describePond, koiProfile, pondBounds } from '@hyperfrontend/demo-koi-lib'
import { createKoiMotion } from '../koi-motion'

/** The pond every fixture here swims in. */
const POND: PondEnvironment = describePond(1200, 800, 1200, 800, false)

/**
 * Builds a koi mid-pond, heading along +x.
 *
 * @param overrides - Entry fields to override.
 * @returns The koi's brain.
 */
function swimmer(overrides: { position?: { x: number; y: number }; heading?: number; depth?: number } = {}): KoiMotion {
  return createKoiMotion({
    profile: koiProfile('vue'),
    pond: POND,
    position: overrides.position ?? { x: 600, y: 400 },
    heading: overrides.heading ?? 0,
    depth: overrides.depth ?? 3,
  })
}

/**
 * Runs a koi forward at sixty frames a second.
 *
 * @param motion - The koi to run.
 * @param seconds - How long to run for.
 * @param fromS - Elapsed seconds the run starts at.
 */
function run(motion: KoiMotion, seconds: number, fromS = 0): void {
  const frames = Math.round(seconds * 60)
  for (let frame = 1; frame <= frames; frame += 1) {
    motion.advance(1 / 60, fromS + frame / 60)
  }
}

/**
 * Reads the shortest signed angle between two headings.
 *
 * @param from - The earlier heading.
 * @param to - The later heading.
 * @returns The signed delta in radians, in `[-π, π]`.
 */
function angleDelta(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) {
    delta -= 2 * Math.PI
  }
  while (delta < -Math.PI) {
    delta += 2 * Math.PI
  }
  return delta
}

/**
 * Runs a koi and reports the sharpest per-frame heading change it made.
 *
 * @param motion - The koi to run.
 * @param seconds - How long to run for.
 * @returns The largest single-frame turn, in radians.
 */
function sharpestTurn(motion: KoiMotion, seconds: number): number {
  const frames = Math.round(seconds * 60)
  let previous = motion.state.heading
  let sharpest = 0
  for (let frame = 1; frame <= frames; frame += 1) {
    motion.advance(1 / 60, frame / 60)
    sharpest = Math.max(sharpest, Math.abs(angleDelta(previous, motion.state.heading)))
    previous = motion.state.heading
  }
  return sharpest
}

/**
 * Builds a neighbour crossing the koi's bow.
 *
 * @param overrides - Fields to override.
 * @returns The observation.
 */
function crossing(overrides: Partial<NeighborObservation> = {}): NeighborObservation {
  return { framework: 'react', x: 660, y: 460, heading: -Math.PI / 2, speed: 120, depth: 3, length: 130, girth: 15, ...overrides }
}

describe('createKoiMotion', () => {
  it('starts where it was placed', () => {
    expect(swimmer().state.position).toEqual({ x: 600, y: 400 })
  })

  it('starts relaxed', () => {
    expect(swimmer().state.phase).toBe('relaxed')
  })

  it('starts at the depth it entered at', () => {
    expect(swimmer({ depth: 5 }).state.depth).toBe(5)
  })

  it('swims forward under its own power', () => {
    const motion = swimmer()
    run(motion, 1)
    expect(motion.state.position.x).toBeGreaterThan(600)
  })

  it('renders larger nearer the light', () => {
    expect(swimmer({ depth: 6 }).state.length).toBeGreaterThan(swimmer({ depth: 0 }).state.length)
  })
})

describe('boundary behaviour', () => {
  it('turns back rather than leaving the pond', () => {
    const bounds = pondBounds(POND)
    // why: Half a fish-length from the wall heading straight at it, a koi that did not steer would cross within a second — so staying inside AND ending up pointed back is the honest proof it turned rather than drifted.
    const motion = swimmer({ position: { x: bounds.right - POND.fishLength * 0.5, y: 400 }, heading: 0 })
    run(motion, 2)
    expect(motion.state.position.x).toBeLessThan(bounds.right)
    // why: A wall-avoiding koi carves round to run along the boundary rather than reversing on the spot, so a heading well past a wander's reach — not a full 180 — is what proves it steered.
    expect(Math.abs(motion.state.heading)).toBeGreaterThan(Math.PI / 3)
  })

  it('never clamps a koi that has swum off screen', () => {
    const motion = swimmer({ position: { x: POND.width + 20, y: 400 }, heading: 0 })
    run(motion, 0.2)
    expect(motion.state.position.x).toBeGreaterThan(POND.width)
  })

  it('curves away rather than reversing on the spot', () => {
    const bounds = pondBounds(POND)
    const motion = swimmer({ position: { x: bounds.right - POND.fishLength * 1.5, y: 400 }, heading: 0 })
    const sharpest = sharpestTurn(motion, 1.5)
    // why: The koi must turn away from the wall, but a body carves a curve — a single-frame jump near π would be a sprite spinning, not a fish turning.
    expect(Math.abs(motion.state.heading)).toBeGreaterThan(Math.PI / 4)
    expect(sharpest).toBeLessThan(0.2)
  })
})

describe('startle', () => {
  it('bolts from a strike that lands close', () => {
    const motion = swimmer()
    expect(motion.startle({ x: 620, y: 410, intensity: 1 })).toBe(true)
  })

  it('ignores a strike far outside what it can notice', () => {
    const motion = swimmer()
    expect(motion.startle({ x: 30_000, y: 30_000, intensity: 1 })).toBe(false)
  })

  it('ignores a strike too gentle to be worth fleeing', () => {
    const motion = swimmer()
    expect(motion.startle({ x: 620, y: 410, intensity: 0.02 })).toBe(false)
  })

  it('reads as escaping while it flees', () => {
    const motion = swimmer()
    motion.startle({ x: 620, y: 410, intensity: 1 })
    run(motion, 0.2)
    expect(motion.state.phase).toBe('escape')
  })

  it('puts water between itself and what struck', () => {
    const motion = swimmer()
    motion.startle({ x: 620, y: 400, intensity: 1 })
    // why: A koi cannot reverse on the spot — it carves away over about a second, so the honest assertion is the water it ends up with, not an axis it crosses.
    run(motion, 3)
    expect(Math.hypot(motion.state.position.x - 620, motion.state.position.y - 400)).toBeGreaterThan(POND.fishLength * 2)
  })

  it('bursts faster than it cruises', () => {
    const cruising = swimmer()
    run(cruising, 1)
    const fleeing = swimmer()
    fleeing.startle({ x: 620, y: 410, intensity: 1 })
    run(fleeing, 1)
    expect(fleeing.state.speed).toBeGreaterThan(cruising.state.speed)
  })

  it('resumes an ambient cruise once the escape unwinds', () => {
    const motion = swimmer()
    motion.startle({ x: 620, y: 410, intensity: 1 })
    run(motion, 12)
    expect(motion.isFleeing).toBe(false)
  })
})

describe('depth', () => {
  it('takes the level the host granted', () => {
    const motion = swimmer()
    motion.setDepth(6)
    expect(motion.state.depth).toBe(6)
  })

  it('reads as changing depth while it rolls between levels', () => {
    const motion = swimmer()
    run(motion, 0.1)
    motion.setDepth(6)
    run(motion, 0.2, 0.1)
    expect(motion.state.phase).toBe('depth-transition')
  })

  it('ignores a grant for the level it already holds', () => {
    const motion = swimmer({ depth: 4 })
    run(motion, 0.1)
    motion.setDepth(4)
    run(motion, 0.2, 0.1)
    expect(motion.state.phase).not.toBe('depth-transition')
  })

  it('asks to change depth to settle a crossing when it is willing to', () => {
    const bold = createKoiMotion({
      profile: { ...koiProfile('vue'), traits: { ...koiProfile('vue').traits, depthWillingness: 0.95 } },
      pond: POND,
      position: { x: 600, y: 400 },
      heading: 0,
      depth: 3,
    })
    bold.observe([crossing()])
    run(bold, 0.1)
    expect(bold.takeDepthRequest()).not.toBeNull()
  })

  it('asks only once rather than every frame', () => {
    const bold = createKoiMotion({
      profile: { ...koiProfile('vue'), traits: { ...koiProfile('vue').traits, depthWillingness: 0.95 } },
      pond: POND,
      position: { x: 600, y: 400 },
      heading: 0,
      depth: 3,
    })
    bold.observe([crossing()])
    run(bold, 0.1)
    bold.takeDepthRequest()
    expect(bold.takeDepthRequest()).toBeNull()
  })

  it('has nothing to ask for while the water is empty', () => {
    const motion = swimmer()
    run(motion, 1)
    expect(motion.takeDepthRequest()).toBeNull()
  })
})

describe('outline', () => {
  it('reports itself by framework so the host can tell the shoal apart', () => {
    expect(swimmer().outline().framework).toBe('vue')
  })

  it('thins the spine down to the samples the host needs', () => {
    expect(swimmer().outline().spine).toHaveLength(5)
  })

  it('carries a half-width for every sample', () => {
    const outline = swimmer().outline()
    expect(outline.girth).toHaveLength(outline.spine.length)
  })

  it('reports the course the host steers its neighbours around', () => {
    const motion = swimmer({ heading: 1 })
    expect(motion.outline().heading).toBeCloseTo(1)
  })

  it('never reports a coordinate the host cannot use', () => {
    const motion = swimmer()
    run(motion, 4)
    expect(motion.outline().spine.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })
})

describe('setTune', () => {
  it('scales the cruise without erasing this koi its own pace', () => {
    const slowed = swimmer()
    slowed.setTune({ speedScale: 0.4 })
    run(slowed, 2)
    const cruising = swimmer()
    run(cruising, 2)
    expect(slowed.state.speed).toBeLessThan(cruising.state.speed * 0.6)
  })

  it('keeps fields the tune left out at their current value', () => {
    const motion = swimmer()
    motion.setTune({ speedScale: 0.4 })
    motion.setTune({ wanderScale: 1.2 })
    run(motion, 2)
    const cruising = swimmer()
    run(cruising, 2)
    expect(motion.state.speed).toBeLessThan(cruising.state.speed * 0.6)
  })
})

describe('setPond', () => {
  it('adopts a resized world', () => {
    const motion = swimmer()
    const wider = describePond(2400, 1600, 2400, 1600, false)
    motion.setPond(wider)
    run(motion, 0.1)
    expect(motion.state.length).toBeGreaterThan(swimmer().state.length)
  })

  it('damps its swimming when the visitor asks for reduced motion', () => {
    const calm = swimmer()
    calm.setPond(describePond(1200, 800, 1200, 800, true))
    calm.startle({ x: 620, y: 410, intensity: 1 })
    run(calm, 0.5)
    const brisk = swimmer()
    brisk.startle({ x: 620, y: 410, intensity: 1 })
    run(brisk, 0.5)
    expect(calm.state.speed).toBeLessThan(brisk.state.speed)
  })
})
