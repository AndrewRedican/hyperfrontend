import type { BeatEvent, RhythmEvent } from '../rhythm-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPENSATORY_FACTOR, DEFAULT_BPM, FLATLINE_HOLD_MS, HOLD_SUPPRESS_MS, JITTER_SPREAD, createRhythmEngine } from '../rhythm-engine'

/** A deterministic sampler pinned to the distribution's centre — the base interval, exactly. */
const midpoint = (min: number, max: number) => (min + max) / 2

/** Builds an engine at 60 bpm with midpoint jitter so the base interval is exactly 1000 ms. */
function createHarness(options: { bpm?: number; gaussian?: (min: number, max: number) => number } = {}) {
  const engine = createRhythmEngine({ bpm: options.bpm ?? 60, gaussian: options.gaussian ?? midpoint })
  const beats: BeatEvent[] = []
  const rhythms: RhythmEvent[] = []
  engine.onBeat((beat) => beats.push(beat))
  engine.onRhythm((change) => rhythms.push(change))
  return { engine, beats, rhythms }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('cadence', () => {
  it('fires one beat per base interval at midpoint jitter', () => {
    const { engine, beats } = createHarness()
    engine.start()
    vi.advanceTimersByTime(3000)
    expect(beats.map((beat) => beat.seq)).toEqual([1, 2, 3])
  })

  it('carries the full beat payload', () => {
    const { engine, beats } = createHarness()
    engine.start()
    vi.advanceTimersByTime(1000)
    expect(beats).toEqual([{ at: 1000, seq: 1, bpm: 60, source: 'rhythm' }])
  })

  it('announces the beating state at start', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    expect(rhythms).toEqual([{ state: 'beating', bpm: 60 }])
  })

  it('starting twice does not double the rhythm', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.start()
    vi.advanceTimersByTime(1000)
    expect(beats).toHaveLength(1)
  })

  it('stop silences the rhythm', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.stop()
    vi.advanceTimersByTime(5000)
    expect(beats).toHaveLength(0)
  })

  it('defaults the baseline to the resting rate', () => {
    const engine = createRhythmEngine({ gaussian: midpoint })
    expect(engine.getBaselineBpm()).toBe(DEFAULT_BPM)
  })
})

describe('jitter bounds', () => {
  it('samples the gaussian over the band around the base interval', () => {
    const bands: Array<[number, number]> = []
    const { engine } = createHarness({
      gaussian: (min, max) => {
        bands.push([min, max])
        return (min + max) / 2
      },
    })
    engine.start()
    expect(bands).toEqual([[1000 * (1 - JITTER_SPREAD), 1000 * (1 + JITTER_SPREAD)]])
  })

  it('holds the beat back through the top of the jitter band', () => {
    const { engine, beats } = createHarness({ gaussian: (_min, max) => max })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 + JITTER_SPREAD) - 1)
    expect(beats).toHaveLength(0)
  })

  it('fires at the top of the jitter band', () => {
    const { engine, beats } = createHarness({ gaussian: (_min, max) => max })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 + JITTER_SPREAD))
    expect(beats).toHaveLength(1)
  })

  it('fires early at the bottom of the jitter band', () => {
    const { engine, beats } = createHarness({ gaussian: (min) => min })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 - JITTER_SPREAD))
    expect(beats).toHaveLength(1)
  })

  it('the default sampler never fires outside the jitter band', () => {
    const engine = createRhythmEngine({ bpm: 60 })
    const beats: BeatEvent[] = []
    engine.onBeat((beat) => beats.push(beat))
    engine.start()
    // why: randomGaussian resamples until the draw lands inside [min, max], so the band edges are hard guarantees, not probabilities.
    vi.advanceTimersByTime(1000 * (1 - JITTER_SPREAD) - 1)
    const early = beats.length
    vi.advanceTimersByTime(1000 * (JITTER_SPREAD + JITTER_SPREAD) + 1)
    expect([early, beats.length]).toEqual([0, 1])
  })
})

describe('user beats', () => {
  it('tap fires an immediate user beat', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.tap()
    expect(beats).toEqual([expect.objectContaining({ seq: 1, source: 'user' })])
  })

  it('a user beat is followed by the compensatory pause', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.tap()
    vi.advanceTimersByTime(1000 * COMPENSATORY_FACTOR - 1)
    expect(beats).toHaveLength(1)
  })

  it('the rhythm resumes after the compensatory pause', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.tap()
    vi.advanceTimersByTime(1000 * COMPENSATORY_FACTOR)
    expect(beats.map((beat) => beat.source)).toEqual(['user', 'rhythm'])
  })

  it('a press released before the hold threshold acts as a tap', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(HOLD_SUPPRESS_MS - 1)
    engine.release()
    expect(beats).toEqual([expect.objectContaining({ source: 'user' })])
  })
})

describe('suppression and flatline', () => {
  it('a sustained hold suppresses the rhythm', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(HOLD_SUPPRESS_MS)
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'suppressed', bpm: 0 })
  })

  it('no beats fire while suppressed', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(FLATLINE_HOLD_MS - 1)
    expect(beats).toHaveLength(0)
  })

  it('tap is ignored while held', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(HOLD_SUPPRESS_MS)
    engine.tap()
    expect(beats).toHaveLength(0)
  })

  it('the full hold flatlines the rhythm', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(FLATLINE_HOLD_MS)
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'flatline', bpm: 0 })
  })

  it('the flatline threshold is exactly three seconds of hold', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(2999)
    const beforeThreshold = rhythms[rhythms.length - 1]
    vi.advanceTimersByTime(1)
    expect([beforeThreshold, rhythms[rhythms.length - 1]]).toEqual([
      { state: 'suppressed', bpm: 0 },
      { state: 'flatline', bpm: 0 },
    ])
  })

  it('a release without a press changes nothing', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.release()
    expect(rhythms).toHaveLength(1)
  })
})

describe('recovery', () => {
  function holdToFlatlineAndRelease(harness: ReturnType<typeof createHarness>) {
    harness.engine.start()
    harness.engine.press()
    vi.advanceTimersByTime(FLATLINE_HOLD_MS)
    harness.engine.release()
  }

  it('release from flatline enters recovery at half the baseline', () => {
    const harness = createHarness()
    holdToFlatlineAndRelease(harness)
    expect(harness.rhythms[harness.rhythms.length - 1]).toEqual({ state: 'recovering', bpm: 30 })
  })

  it('the first recovery beat is slower than baseline', () => {
    const harness = createHarness()
    holdToFlatlineAndRelease(harness)
    vi.advanceTimersByTime(1999)
    expect(harness.beats).toHaveLength(0)
  })

  it('the first recovery beat lands at the recovery interval', () => {
    const harness = createHarness()
    holdToFlatlineAndRelease(harness)
    vi.advanceTimersByTime(2000)
    expect(harness.beats).toEqual([expect.objectContaining({ source: 'rhythm', bpm: 30 })])
  })

  it('recovery beats ramp back toward baseline', () => {
    const harness = createHarness()
    holdToFlatlineAndRelease(harness)
    vi.advanceTimersByTime(4000)
    expect(harness.beats.map((beat) => beat.bpm)).toEqual([30, 45])
  })

  it('the rhythm settles back to beating at baseline', () => {
    const harness = createHarness()
    holdToFlatlineAndRelease(harness)
    vi.advanceTimersByTime(20000)
    expect(harness.rhythms[harness.rhythms.length - 1]).toEqual({ state: 'beating', bpm: 60 })
  })

  it('release from suppression (before flatline) also recovers', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(HOLD_SUPPRESS_MS)
    engine.release()
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'recovering', bpm: 30 })
  })
})

describe('setRate', () => {
  it('clamps a rate above the band to the maximum', () => {
    const { engine } = createHarness()
    expect(engine.setRate(500)).toBe(180)
  })

  it('clamps a rate below the band to the minimum', () => {
    const { engine } = createHarness()
    expect(engine.setRate(10)).toBe(40)
  })

  it('echoes the applied rate as a rhythm event', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.setRate(100)
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'beating', bpm: 100 })
  })

  it('repaces the pending beat at the new rate', () => {
    const { engine, beats } = createHarness()
    engine.start()
    engine.setRate(120)
    vi.advanceTimersByTime(500)
    expect(beats).toEqual([expect.objectContaining({ bpm: 120 })])
  })

  it('caps an in-flight recovery ramp at a lowered baseline', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.press()
    vi.advanceTimersByTime(FLATLINE_HOLD_MS)
    engine.release()
    // how: The first recovery beat ramps pacing to 45 bpm; lowering the baseline to 40 must cap the ramp.
    vi.advanceTimersByTime(2000)
    engine.setRate(40)
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'recovering', bpm: 40 })
  })

  it('keeps pacing the new rate after recovery completes', () => {
    const { engine, rhythms } = createHarness()
    engine.start()
    engine.setRate(120)
    engine.press()
    vi.advanceTimersByTime(FLATLINE_HOLD_MS)
    engine.release()
    vi.advanceTimersByTime(20000)
    expect(rhythms[rhythms.length - 1]).toEqual({ state: 'beating', bpm: 120 })
  })
})

describe('unsubscribe', () => {
  it('a removed beat listener hears nothing further', () => {
    const engine = createRhythmEngine({ bpm: 60, gaussian: midpoint })
    const beats: BeatEvent[] = []
    const off = engine.onBeat((beat) => beats.push(beat))
    engine.start()
    off()
    vi.advanceTimersByTime(1000)
    expect(beats).toHaveLength(0)
  })

  it('a removed rhythm listener hears nothing further', () => {
    const engine = createRhythmEngine({ bpm: 60, gaussian: midpoint })
    const rhythms: RhythmEvent[] = []
    const off = engine.onRhythm((change) => rhythms.push(change))
    off()
    engine.start()
    expect(rhythms).toHaveLength(0)
  })
})
