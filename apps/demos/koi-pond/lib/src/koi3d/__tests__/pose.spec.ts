import type { SpinePose } from '../spine-pose.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MOTION, DEFAULT_TRIM, PIVOT_STATION, resolveKoiConfig } from '../config.js'
import { SPINE_SAMPLES, STILL_SWIM, evaluateSpine, sampleSpinePose } from '../spine-pose.js'
import { MOTION_PRESETS, createSwimState, targetSwim } from '../swim-state.js'

/** Adds up the distance between consecutive stations of a posed spine. */
function arcLength(pose: SpinePose): number {
  return pose.stations.reduce((total, station, index) => {
    const previous = pose.stations[index - 1]
    return previous === undefined
      ? total
      : total +
          Math.hypot(
            station.position[0] - previous.position[0],
            station.position[1] - previous.position[1],
            station.position[2] - previous.position[2]
          )
  }, 0)
}

/** The widest lateral excursion the tail reaches over one full beat. */
function tailSweep(parameters: Parameters<typeof evaluateSpine>[1]): number {
  const offsets = Array.from(
    { length: 48 },
    (_unused, step) => evaluateSpine(1, parameters, (step / 48) * Math.PI * 2).stations[SPINE_SAMPLES - 1]?.position[2] ?? 0
  )
  return Math.max(...offsets) - Math.min(...offsets)
}

describe('evaluateSpine', () => {
  it('poses the same spine for the same time and the same swim', () => {
    expect(evaluateSpine(1, targetSwim(MOTION_PRESETS['Relaxed swim'] ?? DEFAULT_MOTION), 1.4)).toEqual(
      evaluateSpine(1, targetSwim(MOTION_PRESETS['Relaxed swim'] ?? DEFAULT_MOTION), 1.4)
    )
  })

  it('lays a still koi out straight along its own axis', () => {
    expect(evaluateSpine(1, STILL_SWIM, 0).stations.every((station) => Math.abs(station.position[2]) < 1e-9)).toBe(true)
  })

  it('holds the koi exactly its own length however hard it is bent', () => {
    expect(arcLength(evaluateSpine(1, targetSwim(MOTION_PRESETS.Escape ?? DEFAULT_MOTION), 2.1))).toBeCloseTo(
      arcLength(evaluateSpine(1, STILL_SWIM, 0)),
      6
    )
  })

  it('holds its length through every phase of a hard turn', () => {
    const swim = targetSwim({ ...DEFAULT_MOTION, speed: 1.1, turnRate: 2.6 })
    const lengths = Array.from({ length: 16 }, (_unused, step) => arcLength(evaluateSpine(1, swim, (step / 16) * Math.PI * 2)))
    expect(lengths.every((length) => Math.abs(length - (lengths[0] ?? 0)) < 1e-6)).toBe(true)
  })

  it('anchors the koi at the station it pivots around', () => {
    const pose = evaluateSpine(1, STILL_SWIM, 0)
    expect(pose.stations[Math.round(PIVOT_STATION * (SPINE_SAMPLES - 1))]?.position).toEqual([
      expect.closeTo(0, 12),
      expect.closeTo(0, 12),
      expect.closeTo(0, 12),
    ])
  })

  it('swings the head toward the left flank on a left turn', () => {
    const pose = evaluateSpine(1, { ...STILL_SWIM, turnBend: 1.6 }, 0)
    expect(pose.stations[0]?.yaw ?? 0).toBeGreaterThan(0)
  })

  it('swings the head toward the right flank on a right turn', () => {
    const pose = evaluateSpine(1, { ...STILL_SWIM, turnBend: -1.6 }, 0)
    expect(pose.stations[0]?.yaw ?? 0).toBeLessThan(0)
  })

  it('bends the koi rather than rotating it, so head and tail disagree', () => {
    const pose = evaluateSpine(1, { ...STILL_SWIM, turnBend: 1.6 }, 0)
    expect(Math.abs((pose.stations[0]?.yaw ?? 0) - (pose.stations[SPINE_SAMPLES - 1]?.yaw ?? 0))).toBeGreaterThan(1)
  })

  it('leaves the snout out of the travelling wave, where a koi is stiffest', () => {
    const swim = targetSwim({ ...DEFAULT_MOTION, speed: 0.55 })
    const noses = Array.from({ length: 24 }, (_unused, step) => evaluateSpine(1, swim, (step / 24) * Math.PI * 2).stations[0]?.yaw ?? 0)
    expect(Math.max(...noses) - Math.min(...noses)).toBeLessThan(0.4)
  })

  it('sweeps the tail through about a fifth of a body length at cruise', () => {
    expect(tailSweep(targetSwim({ ...DEFAULT_MOTION, speed: 0.55 }))).toBeGreaterThan(0.08)
  })

  it('sweeps the tail harder the faster the koi swims', () => {
    expect(tailSweep(targetSwim({ ...DEFAULT_MOTION, speed: 1.7 }))).toBeGreaterThan(
      tailSweep(targetSwim({ ...DEFAULT_MOTION, speed: 0.4 }))
    )
  })

  it('carries the wave further forward when the koi bolts', () => {
    expect(targetSwim(MOTION_PRESETS.Escape ?? DEFAULT_MOTION).waveStart).toBeLessThan(
      targetSwim(MOTION_PRESETS['Relaxed swim'] ?? DEFAULT_MOTION).waveStart
    )
  })

  it('pitches the whole body when the koi climbs', () => {
    const pose = evaluateSpine(1, { ...STILL_SWIM, pitch: 0.4 }, 0)
    expect(pose.stations[0]?.position[1] ?? 0).toBeGreaterThan(0.1)
  })
})

describe('sampleSpinePose', () => {
  it('reads a sample exactly at a station', () => {
    const pose = evaluateSpine(1, targetSwim({ ...DEFAULT_MOTION, speed: 0.8 }), 0.9)
    expect(sampleSpinePose(pose, 0).position).toEqual(pose.stations[0]?.position)
  })

  it('interpolates between two stations', () => {
    const pose = evaluateSpine(1, targetSwim({ ...DEFAULT_MOTION, speed: 0.8 }), 0.9)
    const between = sampleSpinePose(pose, 0.5 / (SPINE_SAMPLES - 1)).position[0]
    expect(between).toBeCloseTo(((pose.stations[0]?.position[0] ?? 0) + (pose.stations[1]?.position[0] ?? 0)) / 2, 9)
  })

  it('clamps a station past the caudal tip back onto the koi', () => {
    const pose = evaluateSpine(1, STILL_SWIM, 0)
    expect(sampleSpinePose(pose, 4).position[0]).toBeCloseTo(pose.stations[SPINE_SAMPLES - 1]?.position[0] ?? 0, 12)
  })
})

describe('createSwimState', () => {
  it('starts settled on whatever it was opened with', () => {
    expect(createSwimState({ speed: 1.2 }).swim).toEqual(targetSwim({ ...DEFAULT_MOTION, speed: 1.2 }, DEFAULT_TRIM))
  })

  it('eases toward a new order rather than snapping to it', () => {
    const swim = createSwimState({ speed: 0 })
    swim.setMotion({ speed: 3 })
    swim.advance(0.016)
    expect(swim.swim.amplitude).toBeLessThan(targetSwim({ ...DEFAULT_MOTION, speed: 3 }).amplitude)
  })

  it('arrives at the new order given enough frames', () => {
    const swim = createSwimState({ speed: 0 })
    swim.setMotion({ speed: 3 })
    for (let frame = 0; frame < 400; frame += 1) {
      swim.advance(0.016)
    }
    expect(swim.swim.amplitude).toBeCloseTo(targetSwim({ ...DEFAULT_MOTION, speed: 3 }).amplitude, 3)
  })

  it('advances the beat at the frequency its speed implies', () => {
    const swim = createSwimState({ speed: 1 })
    for (let frame = 0; frame < 10; frame += 1) {
      swim.advance(0.1)
    }
    expect(swim.phase / (Math.PI * 2)).toBeCloseTo(swim.frequency, 1)
  })

  it('reaches the same pose at the same phase whatever frame rate it was driven at', () => {
    const coarse = createSwimState({ speed: 1.4 })
    const fine = createSwimState({ speed: 1.4 })
    for (let frame = 0; frame < 30; frame += 1) {
      coarse.advance(1 / 30)
    }
    for (let frame = 0; frame < 120; frame += 1) {
      fine.advance(1 / 120)
    }
    expect(coarse.phase).toBeCloseTo(fine.phase, 4)
  })

  it('takes a trimmed koi through a bigger tail beat than an untrimmed one', () => {
    expect(createSwimState({ speed: 0.6 }, { amplitude: 1.6 }).swim.amplitude).toBeGreaterThan(
      createSwimState({ speed: 0.6 }).swim.amplitude
    )
  })

  it('holds the beat exactly where a scrub put it', () => {
    const swim = createSwimState({ speed: 0.6 })
    swim.setPhase(2.5)
    expect(swim.phase).toBe(2.5)
  })

  it('clamps a long stall so a backgrounded tab does not jump the koi forward', () => {
    const swim = createSwimState({ speed: 1 })
    swim.advance(30)
    expect(swim.phase).toBeLessThan(Math.PI * 2)
  })
})

describe('resolveKoiConfig', () => {
  it('fills every group when given nothing at all', () => {
    expect(resolveKoiConfig()).toEqual(
      expect.objectContaining({
        seed: 1,
        physical: expect.any(Object),
        appearance: expect.any(Object),
        trim: expect.any(Object),
        resolution: expect.any(Object),
      })
    )
  })

  it('keeps the siblings of an overridden nested field', () => {
    expect(resolveKoiConfig({ physical: { head: { width: 1.3 } } }).physical.head).toEqual(
      expect.objectContaining({ width: 1.3, length: 0.26, snout: 0.8 })
    )
  })

  it('keeps the siblings of an overridden top-level field', () => {
    expect(resolveKoiConfig({ physical: { width: 1.4 } }).physical).toEqual(expect.objectContaining({ width: 1.4, height: 1, belly: 0.45 }))
  })

  it('never hands back a reference into the defaults', () => {
    const first = resolveKoiConfig()
    first.physical.width = 99
    expect(resolveKoiConfig().physical.width).toBe(1)
  })
})
