import type { SpineState } from '../spine.js'
import { describe, expect, it } from 'vitest'
import { SPINE_JOINTS, advanceSpine, createSpine, sampleSpine, spineGirth, widthProfile } from '../spine.js'

/** The nose-to-tail length every fixture in this file uses. */
const LENGTH = 120

/** The outcome of swimming a spine for a while. */
interface Run {
  /** The spine as it ended up. */
  spine: SpineState
  /**
   * The widest lateral excursion any joint reached at any point in the run.
   *
   * Measured across every frame rather than sampled at the last one: a snapshot
   * catches whatever point of the tail-beat cycle the run happened to end on,
   * which says nothing about how hard the koi was actually swinging.
   */
  peakSway: number
}

/**
 * Swims a spine forward in a straight line for a number of frames.
 *
 * @param frames - How many frames to run.
 * @param overrides - Step fields to override on every frame.
 * @returns The final spine and the sway envelope of the run.
 */
function swimStraight(frames: number, overrides: Partial<Parameters<typeof advanceSpine>[1]> = {}): Run {
  let spine = createSpine({ x: 0, y: 0 }, 0, LENGTH)
  let peakSway = 0
  for (let frame = 1; frame <= frames; frame += 1) {
    spine = advanceSpine(spine, {
      nose: { x: frame * 4, y: 0 },
      length: LENGTH,
      speed: 240,
      phase: 'relaxed',
      dt: 1 / 60,
      reducedMotion: false,
      ...overrides,
    })
    peakSway = spine.joints.reduce((widest, joint) => Math.max(widest, Math.abs(joint.y)), peakSway)
  }
  return { spine, peakSway }
}

describe('createSpine', () => {
  it('lays out one joint per vertebra', () => {
    expect(createSpine({ x: 0, y: 0 }, 0, LENGTH).joints).toHaveLength(SPINE_JOINTS)
  })

  it('puts the nose exactly where it was placed', () => {
    expect(createSpine({ x: 40, y: 25 }, 0, LENGTH).joints[0]).toEqual({ x: 40, y: 25 })
  })

  it('trails the body behind the heading', () => {
    const spine = createSpine({ x: 0, y: 0 }, 0, LENGTH)
    expect(spine.joints[SPINE_JOINTS - 1]?.x).toBeCloseTo(-LENGTH)
  })

  it('starts with the undulation at rest', () => {
    expect(createSpine({ x: 0, y: 0 }, 0, LENGTH).wavePhase).toBe(0)
  })
})

describe('advanceSpine', () => {
  it('keeps the nose on the position the motion loop set', () => {
    expect(swimStraight(30).spine.joints[0]).toEqual({ x: 120, y: 0 })
  })

  it('holds the body roughly one body length long', () => {
    const { spine } = swimStraight(60)
    const nose = spine.joints[0]
    const tail = spine.joints[SPINE_JOINTS - 1]
    expect(Math.hypot((tail?.x ?? 0) - (nose?.x ?? 0), (tail?.y ?? 0) - (nose?.y ?? 0))).toBeGreaterThan(LENGTH * 0.85)
  })

  it('undulates the body off the axis it swims along', () => {
    expect(swimStraight(40).peakSway).toBeGreaterThan(0)
  })

  it('leaves the nose out of the undulation', () => {
    expect(swimStraight(40).spine.joints[0]?.y).toBe(0)
  })

  it('sways harder in escape than at rest', () => {
    expect(swimStraight(120, { phase: 'escape' }).peakSway).toBeGreaterThan(swimStraight(120, { phase: 'relaxed' }).peakSway)
  })

  it('damps the sway when the visitor asked for reduced motion', () => {
    expect(swimStraight(240, { reducedMotion: true }).peakSway).toBeLessThan(swimStraight(240).peakSway)
  })

  it('settles into a steady beat rather than wagging itself apart', () => {
    // why: The undulation is laid over the centreline, never fed back into it; a spine that read its own displaced joints would grow without bound.
    expect(swimStraight(600).peakSway).toBeLessThan(LENGTH * 0.5)
  })

  it('advances the wave phase as time passes', () => {
    expect(swimStraight(10).spine.wavePhase).toBeGreaterThan(0)
  })

  it('beats the tail faster the faster it swims', () => {
    expect(swimStraight(10, { speed: 600 }).spine.wavePhase).toBeGreaterThan(swimStraight(10, { speed: 60 }).spine.wavePhase)
  })

  it('survives a nose that never moves', () => {
    const { spine } = swimStraight(20, { nose: { x: 0, y: 0 } })
    expect(spine.joints.every((joint) => Number.isFinite(joint.x) && Number.isFinite(joint.y))).toBe(true)
  })

  it('bends the tail off the new course when the koi turns', () => {
    let spine = createSpine({ x: 0, y: 0 }, 0, LENGTH)
    for (let frame = 1; frame <= 12; frame += 1) {
      spine = advanceSpine(spine, {
        nose: { x: 0, y: frame * 6 },
        length: LENGTH,
        speed: 300,
        phase: 'turning',
        dt: 1 / 60,
        reducedMotion: false,
      })
    }
    // why: The chain still trails along +x while the nose has committed to +y — that lag is the turn the visitor sees.
    expect(spine.centreline[SPINE_JOINTS - 1]?.x).toBeLessThan(0)
  })
})

describe('widthProfile', () => {
  it('starts with a narrow snout rather than a full beam', () => {
    expect(widthProfile(0)).toBeCloseTo(0.2)
  })

  it('reaches full beam through the shoulders', () => {
    expect(widthProfile(0.4)).toBe(1)
  })

  it('tapers to a narrow peduncle at the tail', () => {
    expect(widthProfile(1)).toBeCloseTo(0.08)
  })

  it('never widens on the way back from the shoulders', () => {
    const samples = Array.from({ length: 40 }, (_unused, index) => widthProfile(0.44 + (index / 39) * 0.56))
    expect(samples.every((value, index) => index === 0 || value <= (samples[index - 1] ?? 1) + 1e-9)).toBe(true)
  })

  it('clamps a station past the tail to the tail', () => {
    expect(widthProfile(4)).toBe(widthProfile(1))
  })

  it('clamps a station ahead of the nose to the nose', () => {
    expect(widthProfile(-2)).toBe(widthProfile(0))
  })
})

describe('spineGirth', () => {
  it('reports one half-width per vertebra', () => {
    expect(spineGirth(LENGTH, 0.12)).toHaveLength(SPINE_JOINTS)
  })

  it('scales the beam with the girth ratio', () => {
    const widest = Math.max(...spineGirth(LENGTH, 0.12))
    expect(widest).toBeCloseTo(LENGTH * 0.12)
  })
})

describe('sampleSpine', () => {
  it('thins twelve joints down to the requested count', () => {
    expect(sampleSpine(createSpine({ x: 0, y: 0 }, 0, LENGTH).joints, 5)).toHaveLength(5)
  })

  it('keeps the nose at the head of the sample', () => {
    const joints = createSpine({ x: 7, y: 3 }, 0, LENGTH).joints
    expect(sampleSpine(joints, 5)[0]).toEqual(joints[0])
  })

  it('keeps the tail at the end of the sample', () => {
    const joints = createSpine({ x: 0, y: 0 }, 0, LENGTH).joints
    expect(sampleSpine(joints, 5).at(-1)).toEqual(joints.at(-1))
  })

  it('returns the chain untouched when it is already short enough', () => {
    expect(sampleSpine([{ x: 1, y: 1 }], 5)).toEqual([{ x: 1, y: 1 }])
  })

  it('never thins below the two points a segment needs', () => {
    expect(sampleSpine(createSpine({ x: 0, y: 0 }, 0, LENGTH).joints, 1)).toHaveLength(2)
  })
})
