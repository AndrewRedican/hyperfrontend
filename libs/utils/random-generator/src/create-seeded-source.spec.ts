import { describe, expect, it } from '@hyperfrontend/testing'
import { createSeededSource } from './create-seeded-source'

const drawsFrom = (seed: number, count = 5): number[] => {
  const source = createSeededSource(seed)
  const draws: number[] = []
  for (let i = 0; i < count; i++) {
    draws.push(source())
  }
  return draws
}

describe('createSeededSource', () => {
  it('returns the same sequence for the same seed', () => {
    expect(drawsFrom(42)).toEqual(drawsFrom(42))
  })

  it('matches the mulberry32 reference stream for seed 42', () => {
    expect(drawsFrom(42, 3)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099])
  })

  it('returns different sequences for different seeds', () => {
    expect(drawsFrom(1)).not.toEqual(drawsFrom(2))
  })

  it('keeps a fractional seed apart from its integer part', () => {
    expect(drawsFrom(1.5)).not.toEqual(drawsFrom(1))
  })

  it('keeps a negative seed apart from zero', () => {
    expect(drawsFrom(-1)).not.toEqual(drawsFrom(0))
  })

  it('keeps a seed past 32 bits apart from its low word', () => {
    expect(drawsFrom(4294967297)).not.toEqual(drawsFrom(1))
  })

  it('stays at or above 0 and below 1', () => {
    expect(drawsFrom(7, 10000).every((draw) => draw >= 0 && draw < 1)).toBe(true)
  })

  it('throws on a seed that is not a number', () => {
    expect(() => createSeededSource(Number.NaN)).toThrow('Seed must be a finite number.')
  })

  it('throws on an infinite seed', () => {
    expect(() => createSeededSource(Number.POSITIVE_INFINITY)).toThrow('Seed must be a finite number.')
  })
})
