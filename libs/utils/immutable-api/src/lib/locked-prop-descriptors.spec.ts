import { lockedPropertyDescriptors } from './locked-prop-descriptors'

describe('lockedPropertyDescriptors', () => {
  it('returns descriptor given a particular value', () => {
    expect(lockedPropertyDescriptors('hello world')).toEqual({
      value: 'hello world',
      writable: false,
      configurable: false,
      enumerable: false,
    })
    expect(lockedPropertyDescriptors({})).toEqual({
      value: {},
      writable: false,
      configurable: false,
      enumerable: false,
    })
    expect(lockedPropertyDescriptors(5, true)).toEqual({
      value: 5,
      writable: false,
      configurable: false,
      enumerable: true,
    })
  })

  it('sets enumerable to false unless specified otherwise', () => {
    expect(lockedPropertyDescriptors(5).enumerable).toEqual(false)
    expect(lockedPropertyDescriptors(5, false).enumerable).toEqual(false)
    expect(lockedPropertyDescriptors(5, true).enumerable).toEqual(true)
  })
})
