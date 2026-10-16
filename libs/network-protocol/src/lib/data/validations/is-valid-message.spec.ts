import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidMessage } from './is-valid-message'

describe('isValidMessage', () => {
  // note: a table holding an array value wraps every row in an array, because a bare array row is spread across the test's parameters.
  it.each([[''], [{}], [false], ['qwerty'], [42], [[]]])('returns true for the valid message %p', (message) => {
    expect(isValidMessage(message)).toBe(true)
  })

  it.each([[void 0], [null], [{ a: void 0 }], [{ b: null }], [[() => void 0]]])('returns false for the invalid message %p', (message) => {
    expect(isValidMessage(message)).toBe(false)
  })

  it.each([{ a: { b: { c: 'deep' } } }, { nested: [1, 2, { value: 'test' }] }])(
    'returns true for the nested valid object %p',
    (message) => {
      expect(isValidMessage(message)).toBe(true)
    }
  )

  it.each([[{ valid: 'yes', invalid: undefined }], [{ nested: { deep: { value: null } } }], [[1, 2, undefined]]])(
    'returns false for the nested invalid value %p',
    (message) => {
      expect(isValidMessage(message)).toBe(false)
    }
  )

  it.each([BigInt(123), { value: BigInt(456) }])('returns false for the bigint value %p', (message) => {
    expect(isValidMessage(message)).toBe(false)
  })

  it.each([Symbol('test'), { value: Symbol('symbol') }])('returns false for the symbol value %p', (message) => {
    expect(isValidMessage(message)).toBe(false)
  })

  it('returns true for an array mixing numbers, strings and booleans', () => {
    expect(isValidMessage([1, 'two', true])).toBe(true)
  })

  it('returns false for an array mixing valid types with null', () => {
    expect(isValidMessage([1, 'two', null])).toBe(false)
  })

  it('traverses a valid structure nested ten levels deep', () => {
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
  })

  it('traverses to an undefined value nested five levels deep', () => {
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
