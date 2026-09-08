import { isFrozen } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createRandomGenerator } from './create-random-generator'
import { randomUniform } from './random-uniform'
import { isUuidV4 } from './uuid-v4'

const runOf = (seed: number): Array<number | string> => {
  const stream = createRandomGenerator(seed)
  return [
    stream.next(),
    stream.uniform(2, 8),
    stream.gaussian(10, 20),
    stream.exponential(2),
    stream.powerLaw(2, 1, 1000),
    stream.logarithmic(2),
    stream.uuidV4(),
  ]
}

describe('createRandomGenerator', () => {
  it('exposes the seed it was created from', () => {
    expect(createRandomGenerator(42).seed).toBe(42)
  })

  it('replays every method exactly for the same seed', () => {
    expect(runOf(42)).toEqual(runOf(42))
  })

  it('produces a different run for a different seed', () => {
    expect(runOf(42)).not.toEqual(runOf(43))
  })

  it('keeps the gaussian draw inside its bounds', () => {
    const value = createRandomGenerator(3).gaussian(10, 20)
    expect(value).toBeGreaterThanOrEqual(10)
    expect(value).toBeLessThanOrEqual(20)
  })

  it('generates a valid version 4 uuid from the stream', () => {
    expect(isUuidV4(createRandomGenerator(1).uuidV4())).toBe(true)
  })

  it('hands out a detached next that drives the free distributions', () => {
    const { next } = createRandomGenerator(9)
    expect(randomUniform(0, 1, next)).toBe(createRandomGenerator(9).next())
  })

  it('returns a frozen generator', () => {
    expect(isFrozen(createRandomGenerator(5))).toBe(true)
  })

  it('throws on a seed that is not finite', () => {
    expect(() => createRandomGenerator(Number.NEGATIVE_INFINITY)).toThrow('Seed must be a finite number.')
  })
})
