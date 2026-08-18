/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/state-machine`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 */

describe('@hyperfrontend/state-machine ESM', () => {
  describe('actions sub-entry', () => {
    it('is importable', async () => {
      const actions = await import('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', async () => {
      const { start, cancel, pause, success, fail } = await import('@hyperfrontend/state-machine/actions')
      expect(typeof start).toBe('function')
      expect(typeof cancel).toBe('function')
      expect(typeof pause).toBe('function')
      expect(typeof success).toBe('function')
      expect(typeof fail).toBe('function')
    })

    it('creates valid action objects', async () => {
      const { start, success } = await import('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')

      const successAction = success({ data: 'test' })
      expect(successAction).toHaveProperty('type')
      expect(successAction).toHaveProperty('payload')
    })
  })

  describe('store sub-entry', () => {
    it('is importable', async () => {
      const store = await import('@hyperfrontend/state-machine/store')
      expect(store).toBeDefined()
    })

    it('exposes the Store class', async () => {
      const { Store } = await import('@hyperfrontend/state-machine/store')
      expect(typeof Store).toBe('function')
    })
  })

  describe('reducer sub-entry', () => {
    it('is importable', async () => {
      const reducer = await import('@hyperfrontend/state-machine/reducer')
      expect(reducer).toBeDefined()
    })
  })

  describe('selectors sub-entry', () => {
    it('is importable', async () => {
      const selectors = await import('@hyperfrontend/state-machine/selectors')
      expect(selectors).toBeDefined()
    })
  })

  describe('state sub-entry', () => {
    it('is importable', async () => {
      const state = await import('@hyperfrontend/state-machine/state')
      expect(state).toBeDefined()
    })
  })

  describe('async-operation sub-entry', () => {
    it('is importable', async () => {
      const asyncOp = await import('@hyperfrontend/state-machine/async-operation')
      expect(asyncOp).toBeDefined()
    })
  })

  describe('events sub-entry', () => {
    it('is importable', async () => {
      const events = await import('@hyperfrontend/state-machine/events')
      expect(events).toBeDefined()
    })
  })

  describe('models sub-entry', () => {
    it('is importable', async () => {
      const models = await import('@hyperfrontend/state-machine/models')
      expect(models).toBeDefined()
    })
  })
})
