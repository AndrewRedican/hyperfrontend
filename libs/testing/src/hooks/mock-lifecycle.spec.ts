import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMockFn } from '../mock/mock-fn'
import { replaceProperty } from '../mock/replace'
import { registerMockLifecycle } from './mock-lifecycle'

describe('registerMockLifecycle with clear', () => {
  registerMockLifecycle('clear')
  const mock = createMockFn(() => 'kept')

  it('lets a test record calls', () => {
    mock()
    assert.equal(mock.mock.calls.length, 1)
  })

  it('clears the calls before the next test while keeping the implementation', () => {
    assert.deepEqual({ calls: mock.mock.calls.length, returned: mock() }, { calls: 0, returned: 'kept' })
  })
})

describe('registerMockLifecycle with reset', () => {
  registerMockLifecycle('reset,clear')
  const mock = createMockFn().mockReturnValue('dropped')

  it('lets a test record calls', () => {
    mock()
    assert.equal(mock.mock.calls.length, 1)
  })

  it('drops calls and the implementation set since creation before the next test', () => {
    assert.deepEqual({ calls: mock.mock.calls.length, returned: mock() }, { calls: 0, returned: undefined })
  })
})

describe('registerMockLifecycle with restore', () => {
  registerMockLifecycle('restore')
  const settings = { mode: 'light' }

  it('lets a test replace a property', () => {
    replaceProperty(settings, 'mode', 'dark')
    assert.equal(settings.mode, 'dark')
  })

  it('restores the property before the next test', () => {
    assert.equal(settings.mode, 'light')
  })
})

describe('registerMockLifecycle with nothing declared', () => {
  registerMockLifecycle(undefined)
  const mock = createMockFn()

  it('lets a test record calls', () => {
    mock()
    assert.equal(mock.mock.calls.length, 1)
  })

  it('leaves the calls in place for the next test', () => {
    assert.equal(mock.mock.calls.length, 1)
  })
})
