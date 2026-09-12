import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, daysInclusive, dayToTime, formatDay, isDay } from './dates'

describe('isDay', () => {
  it('accepts a real calendar day', () => {
    expect(isDay('2026-06-28')).toBe(true)
  })

  it('rejects a day the calendar does not have', () => {
    expect(isDay('2026-02-30')).toBe(false)
  })

  it('rejects a differently ordered date', () => {
    expect(isDay('28-06-2026')).toBe(false)
  })

  it('rejects a timestamp with a time part', () => {
    expect(isDay('2026-06-28T00:00:00Z')).toBe(false)
  })
})

describe('formatDay and dayToTime', () => {
  it('round-trips a day through its UTC midnight', () => {
    expect(formatDay(dayToTime('2026-06-28'))).toBe('2026-06-28')
  })

  it('refuses arithmetic on a malformed day', () => {
    expect(() => dayToTime('not-a-day')).toThrow('Not a calendar day')
  })
})

describe('addDays', () => {
  it('steps forward across a month boundary', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01')
  })

  it('steps backward across a year boundary', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('steps across a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysInclusive', () => {
  it('counts both ends', () => {
    expect(daysInclusive('2026-09-01', '2026-09-07')).toBe(7)
  })

  it('counts a single day as one', () => {
    expect(daysInclusive('2026-09-01', '2026-09-01')).toBe(1)
  })

  it('goes to zero when the end precedes the start', () => {
    expect(daysInclusive('2026-09-02', '2026-09-01')).toBe(0)
  })
})

describe('daysBetween', () => {
  it('lists every day in order', () => {
    expect(daysBetween('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('is empty when the end precedes the start', () => {
    expect(daysBetween('2026-09-03', '2026-09-01')).toEqual([])
  })
})
