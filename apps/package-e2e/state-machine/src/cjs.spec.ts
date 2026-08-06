/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/state-machine
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 */

describe('@hyperfrontend/state-machine CJS', () => {
  describe('actions sub-entry', () => {
    it('is requireable', () => {
      const actions = require('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', () => {
      const { start, cancel, pause, success, fail } = require('@hyperfrontend/state-machine/actions')
      expect(typeof start).toBe('function')
      expect(typeof cancel).toBe('function')
      expect(typeof pause).toBe('function')
      expect(typeof success).toBe('function')
      expect(typeof fail).toBe('function')
    })

    it('creates valid action objects', () => {
      const { start, success } = require('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')

      const successAction = success({ data: 'test' })
      expect(successAction).toHaveProperty('type')
      expect(successAction).toHaveProperty('payload')
    })
  })

  describe('store sub-entry', () => {
    it('is requireable', () => {
      const store = require('@hyperfrontend/state-machine/store')
      expect(store).toBeDefined()
    })

    it('exposes the Store class', () => {
      const { Store } = require('@hyperfrontend/state-machine/store')
      expect(typeof Store).toBe('function')
    })
  })

  describe('reducer sub-entry', () => {
    it('is requireable', () => {
      const reducer = require('@hyperfrontend/state-machine/reducer')
      expect(reducer).toBeDefined()
    })
  })

  describe('selectors sub-entry', () => {
    it('is requireable', () => {
      const selectors = require('@hyperfrontend/state-machine/selectors')
      expect(selectors).toBeDefined()
    })
  })

  describe('state sub-entry', () => {
    it('is requireable', () => {
      const state = require('@hyperfrontend/state-machine/state')
      expect(state).toBeDefined()
    })
  })

  describe('async-operation sub-entry', () => {
    it('is requireable', () => {
      const asyncOp = require('@hyperfrontend/state-machine/async-operation')
      expect(asyncOp).toBeDefined()
    })
  })

  describe('events sub-entry', () => {
    it('is requireable', () => {
      const events = require('@hyperfrontend/state-machine/events')
      expect(events).toBeDefined()
    })
  })

  describe('models sub-entry', () => {
    it('is requireable', () => {
      const models = require('@hyperfrontend/state-machine/models')
      expect(models).toBeDefined()
    })
  })
})
