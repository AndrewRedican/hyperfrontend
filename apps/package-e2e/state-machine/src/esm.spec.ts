/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/state-machine`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

describe('@hyperfrontend/state-machine ESM', () => {
  describe('actions sub-entry', () => {
    it('is importable', async () => {
      const actions = await import('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', async () => {
      const { start, cancel, pause, success, fail } = await import('@hyperfrontend/state-machine/actions')
      expect({ start, cancel, pause, success, fail }).toEqual({
        start: expect.any(Function),
        cancel: expect.any(Function),
        pause: expect.any(Function),
        success: expect.any(Function),
        fail: expect.any(Function),
      })
    })

    it('creates a start action with a type', async () => {
      const { start } = await import('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')
    })

    it('creates a success action with a type and a payload', async () => {
      const { success } = await import('@hyperfrontend/state-machine/actions')

      const successAction = success({ data: 'test' })
      expect(successAction).toEqual(expect.objectContaining({ type: expect.anything(), payload: expect.anything() }))
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
