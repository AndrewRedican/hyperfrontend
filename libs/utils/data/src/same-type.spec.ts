/* eslint-disable @typescript-eslint/no-empty-function */
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterClassTypes } from './deregister-class-types'
import { registerClassTypes } from './register-class-types'
import { sameType } from './same-type'

describe('sameType', () => {
  it.each([
    [5, -100, 'number'],
    ['hello', 'world', 'string'],
    // eslint-disable-next-line @typescript-eslint/no-array-constructor
    [new Array(), [1, 2, 3], 'array'],
    [{ a: 1 }, { b: 2 }, 'object'],
    [() => {}, function () {}, 'function'],
    [true, false, 'boolean'],
    [Symbol('a'), Symbol(), 'symbol'],
    [null, null, 'null'],
    [undefined, undefined, 'undefined'],
  ])(
    'returns the matching data type for both targets when they are of the same type: %p and %p',
    (left: unknown, right: unknown, expected: string) => {
      expect(sameType(left, right)).toBe(expected)
    }
  )

  it.each([
    [5, '5'],
    [[], {}],
    [null, undefined],
    [true, 1],
  ])('returns false when the targets are of different types: %p and %p', (left: unknown, right: unknown) => {
    expect(sameType(left, right)).toBe(false)
  })
})

describe('sameType with custom registered class types', () => {
  class CustomClassA {}
  class CustomClassB {}

  beforeEach(() => registerClassTypes(CustomClassA, CustomClassB))

  afterAll(() => deregisterClassTypes(CustomClassA, CustomClassB))
  it('returns the matching data type for both targets when they are of the same registered class type CustomClassA', () => {
    expect(sameType(new CustomClassA(), new CustomClassA())).toBe('CustomClassA')
  })

  it('returns the matching data type for both targets when they are of the same registered class type CustomClassB', () => {
    expect(sameType(new CustomClassB(), new CustomClassB())).toBe('CustomClassB')
  })

  it('returns false when the targets are of different registered class types', () => {
    expect(sameType(new CustomClassA(), new CustomClassB())).toBe(false)
  })
})
