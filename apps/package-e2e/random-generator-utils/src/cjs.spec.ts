/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/random-generator-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/random-generator-utils CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const randomGenerator = require('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('should export uuidV4 function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { uuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('should generate valid UUIDv4', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { uuidV4, isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('should export isUuidV4 function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')

    expect(isUuidV4('not-a-uuid')).toBe(false)
    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('should export randomUniform function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(10)
  })

  it('should export randomGaussian function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomGaussian } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('should export randomPseudo function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomPseudo } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('should export randomExponential function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomExponential } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('should export randomPowerLaw function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomPowerLaw } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })
})
