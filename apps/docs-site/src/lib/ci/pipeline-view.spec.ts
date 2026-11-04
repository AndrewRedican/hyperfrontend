import { describe, expect, it } from 'vitest'
import { formatAgo, formatCountdown, formatDuration, formatTick } from './pipeline-view'

describe('formatDuration', () => {
  it.each([
    [800, '0.8s'],
    [47_000, '47s'],
    [1_097_000, '18m 17s'],
    [4_700_000, '1h 18m'],
  ])('formats %d ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('formatTick', () => {
  it.each([
    [0, '0s'],
    [900_000, '15m'],
    [930_000, '15m 30s'],
    [3_600_000, '1h'],
    [4_200_000, '1h 10m'],
  ])('marks %d ms as %s', (ms, text) => {
    expect(formatTick(ms)).toBe(text)
  })
})

describe('formatAgo', () => {
  it.each([
    [10_000, 'just now'],
    [180_000, '3 min ago'],
    [7_200_000, '2 h ago'],
    [-120_000, 'in 2 min'],
  ])('words a difference of %d ms as %s', (delta, text) => {
    expect(formatAgo(1_000_000_000 - delta, 1_000_000_000)).toBe(text)
  })
})

describe('formatCountdown', () => {
  it.each([
    [125_000, '2:05'],
    [-5, '0:00'],
  ])('counts %d ms down as %s', (delta, text) => {
    expect(formatCountdown(1_000_000 + delta, 1_000_000)).toBe(text)
  })
})
