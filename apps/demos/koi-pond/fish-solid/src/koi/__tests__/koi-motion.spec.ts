import type { KoiMotion } from '../koi-motion'
import type { KoiProfile, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
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
function swimmer(
  overrides: { position?: { x: number; y: number }; heading?: number; depth?: number; profile?: KoiProfile } = {}
): KoiMotion {
  return createKoiMotion({
    profile: overrides.profile ?? koiProfile('solid'),
    pond: POND,
    position: overrides.position ?? { x: 600, y: 400 },
    heading: overrides.heading ?? 0,
    depth: overrides.depth ?? 3,
  })
}

/**
 * Builds a koi bold enough to settle a crossing by changing depth.
 *
 * @returns The koi's brain.
 */
function diver(): KoiMotion {
  const profile = koiProfile('solid')
  return createKoiMotion({
    profile: { ...profile, traits: { ...profile.traits, depthWillingness: 0.95 } },
    pond: POND,
    position: { x: 600, y: 400 },
    heading: 0,
    depth: 3,
  })
}

/**
 * Runs a koi forward at sixty frames a second.
 *
 * @param motion - The koi to run.
 * @param seconds - How long to run for.
 */
function run(motion: KoiMotion, seconds: number): void {
  const frames = Math.round(seconds * 60)
  for (let frame = 1; frame <= frames; frame += 1) {
    motion.advance(1 / 60)
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
    motion.advance(1 / 60)
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

describe('pace', () => {
  it('does not hold one constant cruise for a whole minute', () => {
    const motion = swimmer()
    const speeds: number[] = []
    for (let second = 0; second < 90; second += 1) {
      run(motion, 1)
      speeds.push(motion.state.speed)
    }
    // why: The schedule loafs and hurries in bounded events; a koi still cruising at one flat speed after ninety seconds means the pace never reached the water.
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeGreaterThan(1.25)
  })

  it('keeps every scheduled pace inside the loaf-to-burst band', () => {
    const motion = swimmer()
    run(motion, 2)
    let slowest = Number.POSITIVE_INFINITY
    let fastest = 0
    let eased = 0
    for (let second = 0; second < 90; second += 1) {
      run(motion, 1)
      // why: An absence parks the koi at zero on purpose, and the second or two easing back up passes through every low speed; neither says anything about the pace band.
      if (motion.isAway) {
        eased = 2
        continue
      }
      if (eased > 0) {
        eased -= 1
        continue
      }
      slowest = Math.min(slowest, motion.state.speed)
      fastest = Math.max(fastest, motion.state.speed)
    }
    const cruise = POND.fishLength * 0.62
    expect(fastest).toBeLessThan(cruise * 2.2)
    expect(slowest).toBeGreaterThan(POND.fishLength * 0.26 * 0.4)
  })
})

describe('turning', () => {
  it('turns in bounded episodes rather than living in a turn', () => {
    const motion = swimmer()
    let turningStreak = 0
    let longestStreak = 0
    let turningFrames = 0
    const frames = 90 * 60
    for (let frame = 0; frame < frames; frame += 1) {
      motion.advance(1 / 60)
      if (motion.state.phase === 'turning') {
        turningStreak += 1
        turningFrames += 1
        longestStreak = Math.max(longestStreak, turningStreak)
      } else {
        turningStreak = 0
      }
    }
    // why: A turn is an event with an end — the old brain could hold a koi banked for tens of seconds, which is exactly what this bounds.
    expect(longestStreak / 60).toBeLessThan(4)
    expect(turningFrames / frames).toBeLessThan(0.4)
  })

  it('never snaps its heading frame to frame while cruising open water', () => {
    expect(sharpestTurn(swimmer(), 20)).toBeLessThan(0.2)
  })

  it('does not vibrate between left and right', () => {
    const motion = swimmer()
    let previousHeading = motion.state.heading
    let previousDelta = 0
    let reversals = 0
    for (let frame = 0; frame < 30 * 60; frame += 1) {
      motion.advance(1 / 60)
      const delta = angleDelta(previousHeading, motion.state.heading)
      // why: Only a firm swing one way followed immediately by a firm swing the other counts — gentle wander crosses zero all the time and legitimately so.
      if (Math.abs(delta) > 0.015 && Math.abs(previousDelta) > 0.015 && Math.sign(delta) !== Math.sign(previousDelta)) {
        reversals += 1
      }
      previousHeading = motion.state.heading
      previousDelta = delta
    }
    expect(reversals).toBeLessThan(8)
  })

  it('winds its turn rate up and down rather than stepping it, even startled', () => {
    const motion = swimmer()
    motion.startle({ x: 620, y: 400, intensity: 1 })
    let previous = motion.state.heading
    let previousRate = 0
    let sharpestRateStep = 0
    for (let frame = 0; frame < 5 * 60; frame += 1) {
      motion.advance(1 / 60)
      const rate = angleDelta(previous, motion.state.heading) * 60
      sharpestRateStep = Math.max(sharpestRateStep, Math.abs(rate - previousRate))
      previous = motion.state.heading
      previousRate = rate
    }
    // why: The turn rate is a wound state, so even the flee's first frame changes it by no more than the angular acceleration bound allows.
    expect(sharpestRateStep).toBeLessThanOrEqual(2.2 / 60 + 0.005)
  })

  it('cannot pair full escape speed with a tight turn', () => {
    const motion = swimmer()
    motion.startle({ x: 560, y: 400, intensity: 1 })
    run(motion, 1.5)
    expect(motion.state.speed).toBeGreaterThan(POND.fishLength * 1.5)
    // why: A second strike from the flank asks the bolting koi for a hard swing — at that speed the helm is taxed, so the arc must stay visibly wide.
    motion.startle({ x: motion.state.position.x, y: motion.state.position.y - 40, intensity: 1 })
    expect(sharpestTurn(motion, 1.5)).toBeLessThan(0.016)
  })
})

describe('boundary behaviour', () => {
  it('turns back rather than leaving the pond when its seed obeys the correction', () => {
    const bounds = pondBounds(POND)
    // why: The react seed's first boundary approach obeys its correction, so this spec deterministically exercises the turn-back path; solid's own first approach is the slip the next spec proves.
    // why: The gentler helm takes a beat longer to come about, so the correction is judged after four seconds rather than three.
    const motion = swimmer({ profile: koiProfile('react'), position: { x: bounds.right - POND.fishLength * 0.5, y: 400 }, heading: 0 })
    run(motion, 4)
    expect(motion.state.position.x).toBeLessThan(bounds.right)
    expect(Math.abs(motion.state.heading)).toBeGreaterThan(Math.PI / 3)
  })

  it('sometimes slips out, sits away a while, and returns from the opposite side', () => {
    const bounds = pondBounds(POND)
    // why: The solid seed's first boundary approach rolls a slip, so this drives the full leave-wait-warp-return arc deterministically.
    const motion = swimmer({ position: { x: bounds.right - POND.fishLength * 0.5, y: 400 }, heading: 0 })
    let wentAway = false
    let cameBack = false
    let farthestOut = 0
    for (let frame = 0; frame < 40 * 60; frame += 1) {
      motion.advance(1 / 60)
      const { x, y } = motion.state.position
      farthestOut = Math.max(farthestOut, x - bounds.right, bounds.left - x, y - bounds.bottom, bounds.top - y)
      if (motion.isAway) {
        wentAway = true
      }
      if (wentAway && !motion.isAway && x > 0 && x < POND.width && motion.state.position.x < POND.width / 2) {
        cameBack = true
        break
      }
    }
    expect(wentAway).toBe(true)
    // why: Leaving on the right, the wrap re-enters on the left — the visitor reads one fish leaving one side and another arriving later from the other.
    expect(cameBack).toBe(true)
    expect(farthestOut).toBeLessThan(POND.fishLength)
  })

  it('never clamps a koi that has swum off screen', () => {
    const motion = swimmer({ position: { x: POND.width + 20, y: 400 }, heading: 0 })
    run(motion, 0.2)
    expect(motion.state.position.x).toBeGreaterThan(POND.width)
  })

  it('curves away rather than reversing on the spot', () => {
    const bounds = pondBounds(POND)
    const motion = swimmer({ profile: koiProfile('react'), position: { x: bounds.right - POND.fishLength * 1.5, y: 400 }, heading: 0 })
    const sharpest = sharpestTurn(motion, 1.5)
    expect(sharpest).toBeLessThan(0.2)
    expect(motion.state.position.x).toBeLessThan(bounds.right)
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

describe('encounters', () => {
  it('gives way with its speed when the crossing allows it', () => {
    // why: A same-course neighbour just ahead settles with pace, not with a turn — the graded response the depth of the encounter deserves.
    const motion = swimmer()
    run(motion, 0.5)
    const alone = motion.state.speed
    motion.observe([crossing({ x: 680, y: 402, heading: 0, speed: 40 })])
    // why: The crossing sits less than a body length ahead, so the give-way is sampled after one second, while the encounter is still live — by a second and a half the koi has swum past it and lawfully resumed its pace.
    run(motion, 1)
    expect(motion.state.speed).toBeLessThan(alone)
  })

  it('holds its course against a neighbour passing two levels away', () => {
    const undisturbed = swimmer()
    run(undisturbed, 2)
    const layered = swimmer()
    layered.observe([crossing({ depth: 5 })])
    run(layered, 2)
    expect(layered.state.position.x).toBeCloseTo(undisturbed.state.position.x, 0)
    expect(layered.state.position.y).toBeCloseTo(undisturbed.state.position.y, 0)
  })

  it('does not circle a neighbour it keeps observing', () => {
    const motion = swimmer()
    motion.observe([crossing()])
    let total = 0
    let previous = motion.state.heading
    for (let frame = 0; frame < 10 * 60; frame += 1) {
      motion.advance(1 / 60)
      total += angleDelta(previous, motion.state.heading)
      previous = motion.state.heading
    }
    // why: The old brain re-derived its evasion against its own moving heading every frame, which walked it through full circles; the anchored evasion must never accumulate them.
    // why: The solid seed's first evasion opens into one wide tour of the pond — a single sweep just past a full turn — so the bound sits at a circle and a half rather than one.
    expect(Math.abs(total)).toBeLessThan(Math.PI * 3)
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
    run(motion, 0.2)
    expect(motion.state.phase).toBe('depth-transition')
  })

  it('ignores a grant for the level it already holds', () => {
    const motion = swimmer({ depth: 4 })
    run(motion, 0.1)
    motion.setDepth(4)
    run(motion, 0.2)
    expect(motion.state.phase).not.toBe('depth-transition')
  })

  it('asks to change depth to settle a crossing when it is willing to', () => {
    const bold = diver()
    bold.observe([crossing()])
    run(bold, 0.1)
    expect(bold.takeDepthRequest()).not.toBeNull()
  })

  it('asks only once rather than every frame', () => {
    const bold = diver()
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
    expect(swimmer().outline().framework).toBe('solid')
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

describe('speed limits', () => {
  it('never exceeds its hard ceiling even fleeing at full burst', () => {
    const motion = swimmer()
    motion.startle({ x: 600, y: 400, intensity: 1 })
    let fastest = 0
    for (let frame = 0; frame < 5 * 60; frame += 1) {
      motion.advance(1 / 60)
      fastest = Math.max(fastest, motion.state.speed)
    }
    expect(fastest).toBeLessThanOrEqual(POND.fishLength * 3.4 + 1e-6)
  })

  it('builds speed under a bounded acceleration instead of leaping to it', () => {
    const motion = swimmer()
    motion.startle({ x: 600, y: 400, intensity: 1 })
    let previous = motion.state.speed
    let sharpest = 0
    for (let frame = 0; frame < 3 * 60; frame += 1) {
      motion.advance(1 / 60)
      sharpest = Math.max(sharpest, Math.abs(motion.state.speed - previous) * 60)
      previous = motion.state.speed
    }
    expect(sharpest).toBeLessThanOrEqual(POND.fishLength * 2.6 + 1e-6)
  })
})

describe('being carried', () => {
  it('moves to each placed point and trails its spine behind the carry', () => {
    const motion = swimmer()
    motion.place({ x: 700, y: 500 })
    expect(motion.state.position).toEqual({ x: 700, y: 500 })
    expect(motion.state.spine.joints[0]).toEqual({ x: 700, y: 500 })
  })

  it('drops whatever the grab interrupted', () => {
    const motion = swimmer()
    motion.startle({ x: 610, y: 400, intensity: 1 })
    run(motion, 0.5)
    expect(motion.isFleeing).toBe(true)
    motion.place({ x: 700, y: 500 })
    expect(motion.isFleeing).toBe(false)
  })

  it('resumes a calm cruise from the drop point without lunging', () => {
    const motion = swimmer()
    motion.startle({ x: 610, y: 400, intensity: 1 })
    run(motion, 0.5)
    for (let step = 0; step < 30; step += 1) {
      motion.place({ x: 600 + step * 4, y: 400 + step * 3 })
    }
    // why: The released koi may only drift — a scheduled turn, a resumed flee, or a burst off the drop point is exactly the violence the carry must not end in.
    expect(sharpestTurn(motion, 1)).toBeLessThan(0.01)
    expect(motion.state.speed).toBeLessThanOrEqual(POND.fishLength * 0.62 + 1e-6)
  })

  it('leans no more than a nudge per placement however hard the pointer yanks', () => {
    const motion = swimmer({ heading: 0 })
    motion.place({ x: 600, y: 700 })
    expect(Math.abs(angleDelta(0, motion.state.heading))).toBeLessThanOrEqual(0.015 + 1e-9)
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
