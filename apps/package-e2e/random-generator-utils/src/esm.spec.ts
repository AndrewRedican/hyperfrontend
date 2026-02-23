/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/random-generator-utils
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/random-generator-utils ESM', () => {
  it('should be importable', async () => {
    const randomGenerator = await import('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('should export uuidV4 function', async () => {
    const { uuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('should generate valid UUIDv4', async () => {
    const { uuidV4, isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('should export isUuidV4 function', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')

    expect(isUuidV4('not-a-uuid')).toBe(false)
    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('should export randomUniform function', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(10)
  })

  it('should export randomGaussian function', async () => {
    const { randomGaussian } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('should export randomPseudo function', async () => {
    const { randomPseudo } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('should export randomExponential function', async () => {
    const { randomExponential } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('should export randomPowerLaw function', async () => {
    const { randomPowerLaw } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })
})
