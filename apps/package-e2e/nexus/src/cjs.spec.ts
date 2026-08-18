/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/nexus`
 * Tests that the package is requireable under plain Node (no window) and exports work correctly.
 */

describe('@hyperfrontend/nexus CJS', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is requireable without a window', () => {
    const nexus = require('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('exports the createBroker function', () => {
    const { createBroker } = require('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('exports the createChannel function', () => {
    const { createChannel } = require('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('exports the mergeContracts function', () => {
    const { mergeContracts } = require('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('exports the defaultBroker singleton', () => {
    const { defaultBroker } = require('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('exports DEFAULT_CONTRACT', () => {
    const { DEFAULT_CONTRACT } = require('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})
