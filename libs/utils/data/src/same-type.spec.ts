/* eslint-disable @typescript-eslint/no-empty-function */
import { registerClassTypes } from './register-class-types'
import { deregisterClassTypes } from './deregister-class-types'
import { sameType } from './same-type'

describe('sameType', () => {
  it('returns the matching data type for both targets when they are of the same type', () => {
    expect(sameType(5, -100)).toBe('number')
    expect(sameType('hello', 'world')).toBe('string')
    // eslint-disable-next-line @typescript-eslint/no-array-constructor
    expect(sameType(new Array(), [1, 2, 3])).toBe('array')
    expect(sameType({ a: 1 }, { b: 2 })).toBe('object')
    expect(
      sameType(
        () => {},
        function () {}
      )
    ).toBe('function')
    expect(sameType(true, false)).toBe('boolean')
    expect(sameType(Symbol('a'), Symbol())).toBe('symbol')
    expect(sameType(null, null)).toBe('null')
    expect(sameType(undefined, undefined)).toBe('undefined')
  })

  it('returns false when the targets are of different types', () => {
    expect(sameType(5, '5')).toBe(false)
    expect(sameType([], {})).toBe(false)
    expect(sameType(null, undefined)).toBe(false)
    expect(sameType(true, 1)).toBe(false)
  })
})

describe('sameType with custom registered class types', () => {
  class CustomClassA {}
  class CustomClassB {}

  beforeEach(() => registerClassTypes(CustomClassA, CustomClassB))

  afterAll(() => deregisterClassTypes(CustomClassA, CustomClassB))
  it('returns the matching data type for both targets when they are of the same registered class type', () => {
    expect(sameType(new CustomClassA(), new CustomClassA())).toBe('CustomClassA')
    expect(sameType(new CustomClassB(), new CustomClassB())).toBe('CustomClassB')
  })

  it('returns false when the targets are of different registered class types', () => {
    expect(sameType(new CustomClassA(), new CustomClassB())).toBe(false)
  })
})
