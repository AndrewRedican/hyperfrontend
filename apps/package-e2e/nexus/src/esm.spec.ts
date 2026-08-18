/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/nexus`
 * Tests that the package is importable under plain Node (no window) and exports work correctly.
 */

describe('@hyperfrontend/nexus ESM', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is importable without a window', async () => {
    const nexus = await import('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('exports the createBroker function', async () => {
    const { createBroker } = await import('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('exports the createChannel function', async () => {
    const { createChannel } = await import('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('exports the mergeContracts function', async () => {
    const { mergeContracts } = await import('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('exports the defaultBroker singleton', async () => {
    const { defaultBroker } = await import('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('exports DEFAULT_CONTRACT', async () => {
    const { DEFAULT_CONTRACT } = await import('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})
