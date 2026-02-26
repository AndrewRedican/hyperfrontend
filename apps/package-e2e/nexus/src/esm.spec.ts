/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/nexus
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/nexus ESM', () => {
  it('should be importable', async () => {
    const nexus = await import('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('should export createBroker function', async () => {
    const { createBroker } = await import('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('should export createChannel function', async () => {
    const { createChannel } = await import('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('should export mergeContracts function', async () => {
    const { mergeContracts } = await import('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('should export defaultBroker singleton', async () => {
    const { defaultBroker } = await import('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('should export DEFAULT_CONTRACT', async () => {
    const { DEFAULT_CONTRACT } = await import('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})
