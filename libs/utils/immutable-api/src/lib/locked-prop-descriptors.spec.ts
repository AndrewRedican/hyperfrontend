import { describe, expect, it } from '@hyperfrontend/testing'
import { lockedPropertyDescriptors } from './locked-prop-descriptors'

describe('lockedPropertyDescriptors', () => {
  it('returns descriptor given a string value', () => {
    expect(lockedPropertyDescriptors('hello world')).toEqual({
      value: 'hello world',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('returns descriptor given an object value', () => {
    expect(lockedPropertyDescriptors({})).toEqual({
      value: {},
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('returns descriptor given a number value marked enumerable', () => {
    expect(lockedPropertyDescriptors(5, true)).toEqual({
      value: 5,
      writable: false,
      configurable: false,
      enumerable: true,
    })
  })

  it('sets enumerable to false when unspecified', () => {
    expect(lockedPropertyDescriptors(5).enumerable).toEqual(false)
  })

  it('sets enumerable to false when specified as false', () => {
    expect(lockedPropertyDescriptors(5, false).enumerable).toEqual(false)
  })

  it('sets enumerable to true when specified as true', () => {
    expect(lockedPropertyDescriptors(5, true).enumerable).toEqual(true)
  })
})
