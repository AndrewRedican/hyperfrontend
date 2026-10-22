/* lint-disable typescript/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { normalizeToBaseTimeWindow } from './normalize-to-base-time-window'

describe('normalizeToBaseTimeWindow', () => {
  it('returns the same time for a time exactly at a base time window', () => {
    const baseTime = new Date('2024-01-17T00:00:00Z')
    const baseTimeWindow = 30
    expect(normalizeToBaseTimeWindow(baseTime, baseTimeWindow)).toEqual(baseTime)
  })

  it('normalizes time just before a base time window', () => {
    const time = new Date('2024-01-17T00:29:59Z')
    const baseTimeWindow = 30
    const expectedTime = new Date('2024-01-17T00:00:00Z')
    expect(normalizeToBaseTimeWindow(time, baseTimeWindow)).toEqual(expectedTime)
  })

  it('normalizes time just after a base time window', () => {
    const time = new Date('2024-01-17T00:30:01Z')
    const baseTimeWindow = 30
    const expectedTime = new Date('2024-01-17T00:30:00Z')
    expect(normalizeToBaseTimeWindow(time, baseTimeWindow)).toEqual(expectedTime)
  })

  it.each([
    ['null', null as any],
    ['an invalid date', new Date('invalid-date')],
  ])('throws for %s as the time input', (_label: string, time: Date) => {
    expect(() => normalizeToBaseTimeWindow(time, 30)).toThrow()
  })

  it.each([0, -30])('throws for the base time window %s', (baseTimeWindow: number) => {
    const time = new Date('2024-01-17T00:30:00Z')
    expect(() => normalizeToBaseTimeWindow(time, baseTimeWindow)).toThrow()
  })

  it('rejects a NaN base time window', () => {
    expect(() => normalizeToBaseTimeWindow(new Date('2024-01-17T00:30:00Z'), Number.NaN)).toThrow(
      'Base time window must be a positive finite number'
    )
  })

  it('rejects an infinite base time window', () => {
    expect(() => normalizeToBaseTimeWindow(new Date('2024-01-17T00:30:00Z'), Number.POSITIVE_INFINITY)).toThrow(
      'Base time window must be a positive finite number'
    )
  })

  it('rejects a missing base time window', () => {
    expect(() => normalizeToBaseTimeWindow(new Date('2024-01-17T00:30:00Z'), undefined as any)).toThrow(
      'Base time window must be a positive finite number'
    )
  })
})
