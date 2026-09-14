import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lockedProps } from './locked-props'

describe('lockedProps', () => {
  let object: object

  beforeEach(() => {
    object = {}
    lockedProps(object, [
      ['a', 5],
      ['b', false],
    ])
  })

  it('assigns property values', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.value).toEqual(5)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.value).toEqual(false)
  })

  it('prevents property values to be changed', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.writable).toEqual(false)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.writable).toEqual(false)
  })

  it('rejects a property named __proto__', () => {
    const target = {}
    expect(() => lockedProps(target, [['__proto__', { polluted: true }]])).toThrow(TypeError)
    expect(() => lockedProps(target, [['__proto__', { polluted: true }]])).toThrow('Cannot lock a property named __proto__')
  })

  it('leaves the target untouched when rejecting __proto__', () => {
    const target = {}
    expect(() =>
      lockedProps(target, [
        ['safe', 1],
        ['__proto__', { polluted: true }],
      ])
    ).toThrow(TypeError)
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(target, '__proto__')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(target, 'safe')).toBeUndefined()
  })

  it('prevents property descriptors to be changed', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.configurable).toEqual(false)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.configurable).toEqual(false)
  })
})
