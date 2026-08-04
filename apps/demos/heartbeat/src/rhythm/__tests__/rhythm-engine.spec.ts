import type { BeatEvent, RhythmEvent } from '../rhythm-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPENSATORY_FACTOR, DEFAULT_BPM, FLATLINE_HOLD_MS, HOLD_SUPPRESS_MS, JITTER_FRACTION, createRhythmEngine } from '../rhythm-engine'

/** Builds an engine at 60 bpm with midpoint jitter so the base interval is exactly 1000 ms. */
function createHarness(options: { bpm?: number; random?: () => number } = {}) {
  const engine = createRhythmEngine({ bpm: options.bpm ?? 60, random: options.random ?? (() => 0.5) })
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
    const engine = createRhythmEngine({ random: () => 0.5 })
    expect(engine.getBaselineBpm()).toBe(DEFAULT_BPM)
  })
})

describe('jitter bounds', () => {
  it('holds the beat back through the top of the jitter band', () => {
    const { engine, beats } = createHarness({ random: () => 1 })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 + JITTER_FRACTION) - 1)
    expect(beats).toHaveLength(0)
  })

  it('fires at the top of the jitter band', () => {
    const { engine, beats } = createHarness({ random: () => 1 })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 + JITTER_FRACTION))
    expect(beats).toHaveLength(1)
  })

  it('fires early at the bottom of the jitter band', () => {
    const { engine, beats } = createHarness({ random: () => 0 })
    engine.start()
    vi.advanceTimersByTime(1000 * (1 - JITTER_FRACTION))
    expect(beats).toHaveLength(1)
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
    const engine = createRhythmEngine({ bpm: 60, random: () => 0.5 })
    const beats: BeatEvent[] = []
    const off = engine.onBeat((beat) => beats.push(beat))
    engine.start()
    off()
    vi.advanceTimersByTime(1000)
    expect(beats).toHaveLength(0)
  })

  it('a removed rhythm listener hears nothing further', () => {
    const engine = createRhythmEngine({ bpm: 60, random: () => 0.5 })
    const rhythms: RhythmEvent[] = []
    const off = engine.onRhythm((change) => rhythms.push(change))
    off()
    engine.start()
    expect(rhythms).toHaveLength(0)
  })
})
