import type { RegisteredIterableClassEntry } from './models'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { getIterableOperators } from './get-iterable-operators'
import { registerIterableClass } from './register-iterable-class'

describe('getIterableOperators', () => {
  beforeEach(() => deregisterIterableClass())

  afterAll(() => deregisterIterableClass())

  it('returns operators of a registered class', () => {
    class A {}
    const getKeys: RegisteredIterableClassEntry['getKeys'] = (target) => Object.keys(target)
    const read: RegisteredIterableClassEntry['read'] = (target, key) => (target as Record<string, unknown>)[key as string]
    const write: RegisteredIterableClassEntry['write'] = (target, value, key) =>
      ((target as Record<string, unknown>)[key as string] = value)
    const remove: RegisteredIterableClassEntry['remove'] = (target, key) => delete (target as Record<string, unknown>)[key as string]
    const instantiate: RegisteredIterableClassEntry['instantiate'] = () => new A()

    registerIterableClass(A, getKeys, read, write, remove, instantiate)

    const operators = getIterableOperators(A.name)

    expect(typeof operators.getKeys).toBe('function')
    expect(operators.getKeys).not.toBe(getKeys)
    expect(operators.read).toBe(read)
    expect(operators.write).toBe(write)
    expect(operators.remove).toBe(remove)
    expect(operators.instantiate).toBe(instantiate)
  })
})
