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

  it('generates valid UUIDv4', () => {
    const { uuidV4, isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('exports isUuidV4 function', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')

    expect(isUuidV4('not-a-uuid')).toBe(false)
    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('exports randomUniform function', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
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
})
