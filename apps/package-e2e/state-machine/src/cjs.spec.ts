/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/state-machine`
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

describe('@hyperfrontend/state-machine CJS', () => {
  describe('actions sub-entry', () => {
    it('is requireable', () => {
      const actions = require('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', () => {
      const { start, cancel, pause, success, fail } = require('@hyperfrontend/state-machine/actions')
      expect({ start, cancel, pause, success, fail }).toEqual({
        start: expect.any(Function),
        cancel: expect.any(Function),
        pause: expect.any(Function),
        success: expect.any(Function),
        fail: expect.any(Function),
      })
    })

    it('creates a start action with a type', () => {
      const { start } = require('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')
    })

    it('creates a success action with a type and a payload', () => {
      const { success } = require('@hyperfrontend/state-machine/actions')

      const successAction = success({ data: 'test' })
      expect(successAction).toEqual(expect.objectContaining({ type: expect.anything(), payload: expect.anything() }))
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
