import type { RegisteredIterableClassEntry } from './models'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { getIterableOperators } from './get-iterable-operators'
import { registerIterableClass } from './register-iterable-class'

describe('getIterableOperators', () => {
  beforeEach(() => deregisterIterableClass())

  afterAll(() => deregisterIterableClass())

  class A {}
  const getKeys: RegisteredIterableClassEntry['getKeys'] = (target) => Object.keys(target)
  const read: RegisteredIterableClassEntry['read'] = (target, key) => (target as Record<string, unknown>)[key as string]
  const write: RegisteredIterableClassEntry['write'] = (target, value, key) => ((target as Record<string, unknown>)[key as string] = value)
  const remove: RegisteredIterableClassEntry['remove'] = (target, key) => delete (target as Record<string, unknown>)[key as string]
  const instantiate: RegisteredIterableClassEntry['instantiate'] = () => new A()

  it('returns operators of a registered class', () => {
    registerIterableClass(A, getKeys, read, write, remove, instantiate)

    expect(getIterableOperators(A.name)).toEqual({ getKeys: expect.any(Function), read, write, remove, instantiate })
  })

  it('returns a getKeys operator other than the function the class was registered with', () => {
    registerIterableClass(A, getKeys, read, write, remove, instantiate)

    expect(getIterableOperators(A.name).getKeys).not.toBe(getKeys)
  })

  it('returns a getKeys operator that delegates to the one the class was registered with', () => {
    const taggedKeys: RegisteredIterableClassEntry['getKeys'] = (target) => Object.keys(target).map((key) => `registered:${key}`)
    registerIterableClass(A, taggedKeys, read, write, remove, instantiate)

    expect(getIterableOperators(A.name).getKeys(Object.assign(new A(), { k: 1 }))).toEqual(['registered:k'])
  })
})
