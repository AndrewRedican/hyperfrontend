import type { ValuePicker } from './create-value-picker'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createValuePicker } from './create-value-picker'

describe('createValuePicker', () => {
  it('throws an error for empty array', () => {
    expect(() => createValuePicker([])).toThrow('Expected values not to be an empty list.')
  })
  it('throws an error for null input', () => {
    expect(() => createValuePicker(null as never)).toThrow('Expected values not to be an empty list.')
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
      const picked = [valuePicker.next(), valuePicker.next(), valuePicker.next(), valuePicker.next()]
      expect(picked).toEqual(['a', 'b', 'c', 'a'])
    })

    it('state persists between next and current calls', () => {
      valuePicker.next()
      const afterFirstNext = valuePicker.current()
      valuePicker.next()
      const afterSecondNext = valuePicker.current()
      expect({ afterFirstNext, afterSecondNext }).toEqual({ afterFirstNext: 'a', afterSecondNext: 'b' })
    })
  })
})
