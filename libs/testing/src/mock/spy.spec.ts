import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSpy, restoreAllMocks } from './spy'
import { isMockFunction } from './types'

describe('createSpy on methods', () => {
  it('replaces the property with a mock', () => {
    const host = { greet: () => 'real' }
    createSpy(host, 'greet')
    assert.equal(isMockFunction(host.greet), true)
  })

  it('calls through to the original by default', () => {
    const host = { greet: () => 'real' }
    createSpy(host, 'greet')
    assert.equal(host.greet(), 'real')
  })

  it('records calls made through the property', () => {
    const host = { greet: (name: string) => name }
    const spy = createSpy(host, 'greet')
    host.greet('ada')
    assert.deepEqual(spy.mock.calls, [['ada']])
  })

  it('lets the implementation be replaced', () => {
    const host = { greet: () => 'real' }
    createSpy(host, 'greet').mockReturnValue('fake')
    assert.equal(host.greet(), 'fake')
  })

  it('restores the original implementation', () => {
    const host = { greet: () => 'real' }
    const spy = createSpy(host, 'greet')
    spy.mockReturnValue('fake')
    spy.mockRestore()
    assert.equal(host.greet(), 'real')
  })

  it('survives a spy on an inherited method', () => {
    const base = { greet: () => 'base' }
    const derived = Object.create(base) as { greet: () => string }
    createSpy(derived, 'greet').mockReturnValue('spied')
    assert.equal(derived.greet(), 'spied')
  })

  it('removes the own property when restoring an inherited method', () => {
    const base = { greet: () => 'base' }
    const derived = Object.create(base) as { greet: () => string }
    createSpy(derived, 'greet').mockRestore()
    assert.equal(Object.hasOwn(derived, 'greet'), false)
  })

  it('refuses to spy on a property that does not exist', () => {
    assert.throws(() => createSpy({}, 'missing'), TypeError)
  })
})

describe('createSpy on accessors', () => {
  it('replaces the getter', () => {
    const host = {
      get value() {
        return 'real'
      },
    }
    createSpy(host, 'value', 'get').mockReturnValue('fake')
    assert.equal(host.value, 'fake')
  })

  it('restores the getter', () => {
    const host = {
      get value() {
        return 'real'
      },
    }
    createSpy(host, 'value', 'get').mockRestore()
    assert.equal(host.value, 'real')
  })
})

describe('restoreAllMocks', () => {
  it('restores every installed spy', () => {
    const host = { greet: () => 'real' }
    createSpy(host, 'greet').mockReturnValue('fake')
    restoreAllMocks()
    assert.equal(host.greet(), 'real')
  })

  it('leaves nothing installed to restore twice', () => {
    const host = { greet: () => 'real' }
    createSpy(host, 'greet')
    restoreAllMocks()
    assert.doesNotThrow(() => restoreAllMocks())
  })
})
