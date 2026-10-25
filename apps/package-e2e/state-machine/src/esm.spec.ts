/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/state-machine`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/state-machine ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the actions entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/state-machine/actions')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        start: 'function',
        cancel: 'function',
        pause: 'function',
        success: 'function',
        fail: 'function',
      })
    )
  })

  it('exposes the documented surface of the store entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/state-machine/store')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        Store: 'function',
      })
    )
  })

  it('exposes the documented surface of the selectors entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/state-machine/selectors')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        derivedState: 'function',
        notStarted: 'function',
        inProgress: 'function',
        done: 'function',
        successful: 'function',
        failed: 'function',
        retrying: 'function',
        restarting: 'function',
      })
    )
  })

  it('exposes the documented surface of the reducer entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/state-machine/reducer')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        rootReducer: 'function',
      })
    )
  })

  it('exposes the documented surface of the state entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/state-machine/state')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        createInitialState: 'function',
      })
    )
  })

  it('creates a start action with a type', () => {
    const keys = consumer.run(async () => {
      const { start } = await import('@hyperfrontend/state-machine/actions')
      return typeof start().type
    })
    expect(keys).toBe('string')
  })

  it('creates a success action carrying its payload', () => {
    const payload = consumer.run(async () => {
      const { success } = await import('@hyperfrontend/state-machine/actions')
      return success({ data: 'test' }).payload
    })
    expect(payload).toEqual({
      data: 'test',
    })
  })

  it('starts with every flag down', () => {
    const initial = consumer.run(async () => {
      const { createInitialState } = await import('@hyperfrontend/state-machine/state')
      return createInitialState()
    })
    expect(initial).toEqual({
      inProgress: false,
      success: false,
      fail: false,
      halt: false,
    })
  })

  it('reduces a start action into an in-progress state', () => {
    const inProgress = consumer.run(async () => {
      const { start } = await import('@hyperfrontend/state-machine/actions')
      const { rootReducer } = await import('@hyperfrontend/state-machine/reducer')
      const { createInitialState } = await import('@hyperfrontend/state-machine/state')
      return rootReducer(createInitialState(), start()).inProgress
    })
    expect(inProgress).toBe(true)
  })

  it('derives the lifecycle names from a store fed start, fail and success', () => {
    const phases = consumer.run(async () => {
      const { fail, start, success } = await import('@hyperfrontend/state-machine/actions')
      const { derivedState } = await import('@hyperfrontend/state-machine/selectors')
      const { Store } = await import('@hyperfrontend/state-machine/store')
      const NAMES = ['notStarted', 'inProgress', 'done', 'successful', 'failed', 'retrying', 'restarting'] as const
      const store = new Store()
      const phases: string[][] = []
      store.subscribe((state) => phases.push(NAMES.filter((name) => derivedState(state)[name])))
      store.dispatch(start())
      store.dispatch(fail(new Error('offline')))
      store.dispatch(start())
      store.dispatch(success())
      store.dispatch(start())
      return phases
    })
    expect(phases).toEqual([
      ['inProgress'],
      ['done', 'failed'],
      ['inProgress', 'retrying'],
      ['done', 'successful'],
      ['inProgress', 'restarting'],
    ])
  })
})
