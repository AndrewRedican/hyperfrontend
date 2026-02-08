import { isValidMessage } from './is-valid-message'

describe('isValidMessage', () => {
  it('returns true for a valid message', () => {
    expect(isValidMessage('')).toBe(true)
    expect(isValidMessage({})).toBe(true)
    expect(isValidMessage(false)).toBe(true)
    expect(isValidMessage('qwerty')).toBe(true)
    expect(isValidMessage(42)).toBe(true)
    expect(isValidMessage([])).toBe(true)
  })

  it('returns false for a valid message', () => {
    expect(isValidMessage(void 0)).toBe(false)
    expect(isValidMessage(null)).toBe(false)
    expect(isValidMessage({ a: void 0 })).toBe(false)
    expect(isValidMessage({ b: null })).toBe(false)
    expect(isValidMessage([() => void 0])).toBe(false)
  })

  it('returns true for nested valid objects', () => {
    expect(isValidMessage({ a: { b: { c: 'deep' } } })).toBe(true)
    expect(isValidMessage({ nested: [1, 2, { value: 'test' }] })).toBe(true)
  })

  it('returns false for nested invalid values', () => {
    expect(isValidMessage({ valid: 'yes', invalid: undefined })).toBe(false)
    expect(isValidMessage({ nested: { deep: { value: null } } })).toBe(false)
    expect(isValidMessage([1, 2, undefined])).toBe(false)
  })

  it('returns false for bigint values', () => {
    expect(isValidMessage(BigInt(123))).toBe(false)
    expect(isValidMessage({ value: BigInt(456) })).toBe(false)
  })

  it('returns false for symbol values', () => {
    expect(isValidMessage(Symbol('test'))).toBe(false)
    expect(isValidMessage({ value: Symbol('symbol') })).toBe(false)
  })

  it('handles arrays with mixed valid/invalid types', () => {
    expect(isValidMessage([1, 'two', true])).toBe(true)
    expect(isValidMessage([1, 'two', null])).toBe(false)
  })

  it('traverses deeply nested structures using depth options', () => {
    const deeplyNested = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: 'deep value',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
    expect(isValidMessage(deeplyNested)).toBe(true)

    const deeplyNestedInvalid = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: undefined,
            },
          },
        },
      },
    }
    expect(isValidMessage(deeplyNestedInvalid)).toBe(false)
  })
})
