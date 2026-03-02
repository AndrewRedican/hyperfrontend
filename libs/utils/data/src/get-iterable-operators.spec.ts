import type { RegisteredIterableClassEntry } from './models'
import { deregisterIterableClass } from './deregister-iterable-class'
import { getIterableOperators } from './get-iterable-operators'
import { registerIterableClass } from './register-iterable-class'

describe('getIterableOperators', () => {
  beforeEach(() => deregisterIterableClass())

  afterAll(() => deregisterIterableClass())

  it('returns operators of a registered class', () => {
    // arrange
    class A {}
    const getKeys: RegisteredIterableClassEntry['getKeys'] = (target) => Object.keys(target)
    const read: RegisteredIterableClassEntry['read'] = (target, key) => (<Record<string, unknown>>target)[<string>key]
    const write: RegisteredIterableClassEntry['write'] = (target, value, key) => ((<Record<string, unknown>>target)[<string>key] = value)
    const remove: RegisteredIterableClassEntry['remove'] = (target, key) => delete (<Record<string, unknown>>target)[<string>key]
    const instantiate: RegisteredIterableClassEntry['instantiate'] = () => new A()

    registerIterableClass(A, getKeys, read, write, remove, instantiate)

    // act
    const operators = getIterableOperators(A.name)

    // assert
    expect(typeof operators.getKeys).toBe('function')
    expect(operators.getKeys).not.toBe(getKeys) // should be wrapped
    expect(operators.read).toBe(read)
    expect(operators.write).toBe(write)
    expect(operators.remove).toBe(remove)
    expect(operators.instantiate).toBe(instantiate)
  })
})
