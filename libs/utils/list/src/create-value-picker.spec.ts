import type { ValuePicker } from './create-value-picker'
import { createValuePicker } from './create-value-picker'

describe('createValuePicker', () => {
  it('throws an error for empty array', () => {
    expect(() => createValuePicker([])).toThrow('Expected values not to be an empty list.')
  })
  // how is this not working properly?
  it('throws an error for null input', () => {
    expect(() => createValuePicker(<never>null)).toThrow('Expected values not to be an empty list.')
  })

  describe('when initialized with a non-empty array', () => {
    let valuePicker: ValuePicker
    const testValues = ['a', 'b', 'c']

    beforeEach(() => {
      valuePicker = createValuePicker(testValues)
    })

    it('current returns the first element', () => {
      expect(valuePicker.current()).toBe('a')
    })

    it('next cycles through elements and return to start', () => {
      expect(valuePicker.next()).toBe('a')
      expect(valuePicker.next()).toBe('b')
      expect(valuePicker.next()).toBe('c')
      expect(valuePicker.next()).toBe('a')
    })

    it('state persists between next and current calls', () => {
      valuePicker.next()
      expect(valuePicker.current()).toBe('a')
      valuePicker.next()
      expect(valuePicker.current()).toBe('b')
    })
  })
})
