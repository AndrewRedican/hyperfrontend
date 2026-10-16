/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/random-generator-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

describe('@hyperfrontend/random-generator-utils ESM', () => {
  it('is importable', async () => {
    const randomGenerator = await import('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('exports uuidV4 function', async () => {
    const { uuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('generates a UUIDv4 as a string', async () => {
    const { uuidV4 } = await import('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
  })

  it('generates a UUIDv4 that isUuidV4 accepts', async () => {
    const { uuidV4, isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('exports isUuidV4 function', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')
  })

  it('rejects a malformed string through isUuidV4', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('not-a-uuid')).toBe(false)
  })

  it('accepts a well-formed UUIDv4 through isUuidV4', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('exports randomUniform function', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')
  })

  it('draws a uniform value no lower than the minimum', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
  })

  it('draws a uniform value below the maximum', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeLessThan(10)
  })

  it('exports randomGaussian function', async () => {
    const { randomGaussian } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('exports randomPseudo function', async () => {
    const { randomPseudo } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('exports randomExponential function', async () => {
    const { randomExponential } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('exports randomPowerLaw function', async () => {
    const { randomPowerLaw } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })

  it('exports createRandomGenerator', async () => {
    const { createRandomGenerator } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof createRandomGenerator).toBe('function')
  })

  it('replays one seed exactly through createRandomGenerator', async () => {
    const { createRandomGenerator } = await import('@hyperfrontend/random-generator-utils')

    const first = createRandomGenerator(42)
    const second = createRandomGenerator(42)
    expect([first.next(), first.gaussian(0, 10), first.uuidV4()]).toEqual([second.next(), second.gaussian(0, 10), second.uuidV4()])
  })
})
