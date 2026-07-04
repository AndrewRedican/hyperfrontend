import { describe, expect, it } from 'vitest'
import { buildSnapshot, formatTime, isValidAlarmTime, nextOccurrence, wallTimeIn, zoneLabel } from '../clock-time'

const NOON_UTC = Date.UTC(2026, 6, 1, 12, 0, 30, 250)

describe('wallTimeIn', () => {
  it('reads the wall clock of a zone ahead of UTC', () => {
    expect(wallTimeIn(NOON_UTC, 'Asia/Tokyo')).toEqual({ hour: 21, minute: 0, second: 30, day: 1 })
  })

  it('reads midnight as hour zero, not 24', () => {
    expect(wallTimeIn(Date.UTC(2026, 6, 1, 0, 5), 'UTC')).toEqual(expect.objectContaining({ hour: 0, minute: 5 }))
  })
})

describe('formatTime', () => {
  it('renders seconds only for the digital format', () => {
    expect({
      analog: formatTime(NOON_UTC, 'UTC', 'en-US', 'analog'),
      digital: formatTime(NOON_UTC, 'UTC', 'en-US', 'digital'),
    }).toEqual({ analog: '12:00 PM', digital: '12:00:30 PM' })
  })

  it('respects a 24-hour locale', () => {
    expect(formatTime(NOON_UTC, 'UTC', 'de-DE', 'digital')).toBe('12:00:30')
  })
})

describe('zoneLabel', () => {
  it('resolves a short zone name', () => {
    expect(zoneLabel(NOON_UTC, 'UTC', 'en-US')).toBe('UTC')
  })
})

describe('buildSnapshot', () => {
  it('carries every contract field', () => {
    expect(buildSnapshot(NOON_UTC, 'Europe/Madrid', 'es-ES', 'analog')).toEqual({
      epochMs: NOON_UTC,
      iso: '2026-07-01T12:00:30.250Z',
      timezone: 'Europe/Madrid',
      locale: 'es-ES',
      format: 'analog',
      formatted: expect.stringContaining('14:00'),
    })
  })
})

describe('isValidAlarmTime', () => {
  it('accepts zero-padded 24-hour HH:mm and rejects everything else', () => {
    expect(['07:30', '23:59', '00:00', '24:00', '7:30', '07:60', '07:3a', '0730', '07:30:00'].map(isValidAlarmTime)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })
})

describe('nextOccurrence', () => {
  it('targets later today when the time has not passed', () => {
    expect(nextOccurrence('13:30', 'UTC', NOON_UTC)).toBe(Date.UTC(2026, 6, 1, 13, 30))
  })

  it('wraps to tomorrow when the time has passed', () => {
    expect(nextOccurrence('11:00', 'UTC', NOON_UTC)).toBe(Date.UTC(2026, 6, 2, 11, 0))
  })

  it('treats the current minute as tomorrow', () => {
    expect(nextOccurrence('12:00', 'UTC', NOON_UTC)).toBe(Date.UTC(2026, 6, 2, 12, 0))
  })

  it('computes the occurrence in the requested timezone, not UTC', () => {
    // context: 12:00:30 UTC is 21:00:30 in Tokyo, so a 21:30 Tokyo alarm is 30 minutes out.
    expect(nextOccurrence('21:30', 'Asia/Tokyo', NOON_UTC)).toBe(Date.UTC(2026, 6, 1, 12, 30))
  })
})
