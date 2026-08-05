import { describe, expect, it } from 'vitest'
import { DEFAULT_WINDOW_MS, MIN_EFFECTIVE_INTERVAL_MS, createMeasuredBpm } from '../measured-bpm'

/** Feeds beats at a steady interval starting at `from`. */
function feedSteady(measured: ReturnType<typeof createMeasuredBpm>, from: number, intervalMs: number, count: number): number {
  let at = from
  for (let index = 0; index < count; index += 1) {
    at = from + index * intervalMs
    measured.addBeat(at)
  }
  return at
}

describe('createMeasuredBpm', () => {
  it('reads 0 before any beat', () => {
    const measured = createMeasuredBpm()
    expect(measured.readingAt(5000)).toBe(0)
  })

  it('reads 0 with a single beat in the window', () => {
    const measured = createMeasuredBpm()
    measured.addBeat(1000)
    expect(measured.readingAt(1100)).toBe(0)
  })

  it('reads the observed rate from steady beats', () => {
    const measured = createMeasuredBpm()
    const last = feedSteady(measured, 0, 1000, 8)
    expect(measured.readingAt(last + 500)).toBe(60)
  })

  it('an extra closely spaced beat raises the reading', () => {
    const measured = createMeasuredBpm()
    const last = feedSteady(measured, 0, 1000, 8)
    measured.addBeat(last + 200)
    expect(measured.readingAt(last + 400)).toBeGreaterThan(60)
  })

  it('coincident timestamps stay finite and capped', () => {
    const measured = createMeasuredBpm()
    measured.addBeat(1000)
    measured.addBeat(1000)
    expect(measured.readingAt(1000)).toBe(Math.round(60000 / MIN_EFFECTIVE_INTERVAL_MS))
  })

  it('the reading decays while silence grows', () => {
    const measured = createMeasuredBpm()
    const last = feedSteady(measured, 0, 1000, 8)
    expect(measured.readingAt(last + 3000)).toBe(20)
  })

  it('the reading reaches 0 once the window empties', () => {
    const measured = createMeasuredBpm()
    const last = feedSteady(measured, 0, 1000, 8)
    expect(measured.readingAt(last + DEFAULT_WINDOW_MS + 1)).toBe(0)
  })

  it('beats older than the window stop counting', () => {
    const measured = createMeasuredBpm(2000)
    measured.addBeat(0)
    measured.addBeat(500)
    measured.addBeat(3000)
    measured.addBeat(3500)
    expect(measured.readingAt(3600)).toBe(120)
  })

  it('reset clears the reading', () => {
    const measured = createMeasuredBpm()
    feedSteady(measured, 0, 1000, 8)
    measured.reset()
    expect(measured.readingAt(8000)).toBe(0)
  })

  it('rounds to a whole number', () => {
    const measured = createMeasuredBpm()
    const last = feedSteady(measured, 0, 900, 8)
    expect(Number.isInteger(measured.readingAt(last + 100))).toBe(true)
  })
})
