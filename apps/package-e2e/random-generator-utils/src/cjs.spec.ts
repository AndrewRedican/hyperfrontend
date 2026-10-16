/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/random-generator-utils`
 * Tests that the package is requireable and exports work correctly.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

describe('@hyperfrontend/random-generator-utils CJS', () => {
  it('is requireable', () => {
    const randomGenerator = require('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('exports uuidV4 function', () => {
    const { uuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('generates a UUIDv4 as a string', () => {
    const { uuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
  })

  it('generates a UUIDv4 that isUuidV4 accepts', () => {
    const { uuidV4, isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('exports isUuidV4 function', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')
  })

  it('rejects a malformed string through isUuidV4', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('not-a-uuid')).toBe(false)
  })

  it('accepts a well-formed UUIDv4 through isUuidV4', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('exports randomUniform function', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')
  })

  it('draws a uniform value no lower than the minimum', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
  })

  it('draws a uniform value below the maximum', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeLessThan(10)
  })

  it('exports randomGaussian function', () => {
    const { randomGaussian } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('exports randomPseudo function', () => {
    const { randomPseudo } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('exports randomExponential function', () => {
    const { randomExponential } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('exports randomPowerLaw function', () => {
    const { randomPowerLaw } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })

  it('exports createRandomGenerator', () => {
    const { createRandomGenerator } = require('@hyperfrontend/random-generator-utils')
    expect(typeof createRandomGenerator).toBe('function')
  })

  it('replays one seed exactly through createRandomGenerator', () => {
    const { createRandomGenerator } = require('@hyperfrontend/random-generator-utils')

    const first = createRandomGenerator(42)
    const second = createRandomGenerator(42)
    expect([first.next(), first.gaussian(0, 10), first.uuidV4()]).toEqual([second.next(), second.gaussian(0, 10), second.uuidV4()])
  })
})
