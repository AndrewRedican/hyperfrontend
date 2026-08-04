import { describe, expect, it } from 'vitest'
import { COMPLEX_MS, R_PEAK_MS, USER_GAIN, baselineNoise, expectedIntervalMs, isFlatline, traceValue, waveValue } from '../ecg'

describe('waveValue', () => {
  it('reaches full amplitude at the spike peak', () => {
    expect(waveValue(R_PEAK_MS)).toBeCloseTo(1, 5)
  })

  it('dips shallowly on the lead-in', () => {
    expect(waveValue(20)).toBeLessThan(0)
  })

  it('dips shallowly on the settle', () => {
    expect(waveValue(130)).toBeLessThan(0)
  })

  it('stays mostly flat outside the spike window', () => {
    const outside = Array.from({ length: 200 }, (_value, index) => (index * COMPLEX_MS) / 200).filter((phase) => phase < 40 || phase > 110)
    expect(outside.every((phase) => Math.abs(waveValue(phase)) <= 0.12)).toBe(true)
  })

  it('is silent before the complex begins', () => {
    expect(waveValue(-1)).toBe(0)
  })

  it('is silent after the complex ends', () => {
    expect(waveValue(COMPLEX_MS + 1)).toBe(0)
  })

  it('scales with the gain', () => {
    expect(waveValue(R_PEAK_MS, USER_GAIN)).toBeCloseTo(USER_GAIN, 5)
  })
})

describe('traceValue', () => {
  it('draws a user beat taller than a rhythm beat', () => {
    const rhythmPeak = traceValue(R_PEAK_MS, [{ at: 0, source: 'rhythm' }])
    const userPeak = traceValue(R_PEAK_MS, [{ at: 0, source: 'user' }])
    expect(userPeak).toBeGreaterThan(rhythmPeak)
  })

  it('sums overlapping complexes', () => {
    const beats = [
      { at: 0, source: <const>'rhythm' },
      { at: 0, source: <const>'rhythm' },
    ]
    expect(traceValue(R_PEAK_MS, beats)).toBeCloseTo(2, 5)
  })

  it('is flat with no beats in range', () => {
    expect(traceValue(5000, [{ at: 0, source: 'rhythm' }])).toBe(0)
  })
})

describe('isFlatline', () => {
  it('stays live within three expected intervals', () => {
    expect(isFlatline(3000, 0, 60)).toBe(false)
  })

  it('flags silence past three expected intervals', () => {
    expect(isFlatline(3001, 0, 60)).toBe(true)
  })

  it('never flags before the first beat', () => {
    expect(isFlatline(99999, null, 60)).toBe(false)
  })

  it('scales the budget with the rate', () => {
    expect(isFlatline(1501, 0, 120)).toBe(true)
  })
})

describe('expectedIntervalMs', () => {
  it('converts bpm to the interval', () => {
    expect(expectedIntervalMs(60)).toBe(1000)
  })
})

describe('baselineNoise', () => {
  it('stays within the ±0.03 wander band', () => {
    const samples = Array.from({ length: 500 }, (_value, index) => baselineNoise(index * 37))
    expect(samples.every((value) => Math.abs(value) <= 0.03)).toBe(true)
  })
})
