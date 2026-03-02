/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeToBaseTimeWindow } from './normalize-to-base-time-window'

describe('normalizeToBaseTimeWindow', () => {
  it('returns the same time for a time exactly at a base time window', () => {
    const baseTime = new Date('2024-01-17T00:00:00Z')
    const baseTimeWindow = 30 // 30 minutes
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

  it('handles null or invalid time input', () => {
    expect(() => normalizeToBaseTimeWindow(<any>null, 30)).toThrow()
    expect(() => normalizeToBaseTimeWindow(new Date('invalid-date'), 30)).toThrow()
  })

  it('handles zero or negative base time window', () => {
    const time = new Date('2024-01-17T00:30:00Z')
    expect(() => normalizeToBaseTimeWindow(time, 0)).toThrow()
    expect(() => normalizeToBaseTimeWindow(time, -30)).toThrow()
  })
})
