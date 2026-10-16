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
    expect({
      a: Object.getOwnPropertyDescriptor(object, 'a')?.value,
      b: Object.getOwnPropertyDescriptor(object, 'b')?.value,
    }).toEqual({ a: 5, b: false })
  })

  it('prevents property values to be changed', () => {
    expect({
      a: Object.getOwnPropertyDescriptor(object, 'a')?.writable,
      b: Object.getOwnPropertyDescriptor(object, 'b')?.writable,
    }).toEqual({ a: false, b: false })
  })

  it('rejects a property named __proto__ with a TypeError', () => {
    const target = {}
    expect(() => lockedProps(target, [['__proto__', { polluted: true }]])).toThrow(TypeError)
  })

  it('names __proto__ in the message when rejecting it', () => {
    const target = {}
    expect(() => lockedProps(target, [['__proto__', { polluted: true }]])).toThrow('Cannot lock a property named __proto__')
  })

  it('leaves the target untouched when rejecting __proto__', () => {
    const target = {}
    let rejection: unknown
    try {
      lockedProps(target, [
        ['safe', 1],
        ['__proto__', { polluted: true }],
      ])
    } catch (error) {
      rejection = error
    }
    // why: the prototype is compared by identity, because a structural comparison would also accept an empty object swapped in as the prototype.
    expect({
      rejection,
      keepsObjectPrototype: Object.getPrototypeOf(target) === Object.prototype,
      ownProtoDescriptor: Object.getOwnPropertyDescriptor(target, '__proto__'),
      safeDescriptor: Object.getOwnPropertyDescriptor(target, 'safe'),
    }).toEqual({ rejection: expect.any(TypeError), keepsObjectPrototype: true, ownProtoDescriptor: undefined, safeDescriptor: undefined })
  })

  it('prevents property descriptors to be changed', () => {
    expect({
      a: Object.getOwnPropertyDescriptor(object, 'a')?.configurable,
      b: Object.getOwnPropertyDescriptor(object, 'b')?.configurable,
    }).toEqual({ a: false, b: false })
  })
})
