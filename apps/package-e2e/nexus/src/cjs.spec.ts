/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/nexus
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/nexus CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nexus = require('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('should export createBroker function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createBroker } = require('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('should export createChannel function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createChannel } = require('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('should export mergeContracts function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mergeContracts } = require('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('should export defaultBroker singleton', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { defaultBroker } = require('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('should export DEFAULT_CONTRACT', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DEFAULT_CONTRACT } = require('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})
