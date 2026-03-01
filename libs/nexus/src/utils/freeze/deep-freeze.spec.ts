import type { Logger } from '@hyperfrontend/logging'
import { deepFreeze } from './deep-freeze'

describe('deepFreeze', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'error'),
    }
  })

  describe('primitive values', () => {
    it('returns primitive numbers unchanged', () => {
      const value = 42
      const result = deepFreeze(value, mockLogger)
      expect(result).toBe(42)
    })

    it('returns primitive strings unchanged', () => {
      const value = 'hello'
      const result = deepFreeze(value, mockLogger)
      expect(result).toBe('hello')
    })

    it('returns primitive booleans unchanged', () => {
      const value = true
      const result = deepFreeze(value, mockLogger)
      expect(result).toBe(true)
    })

    it('returns null unchanged', () => {
      const value = null
      const result = deepFreeze(value, mockLogger)
      expect(result).toBe(null)
    })

    it('returns undefined unchanged', () => {
      const value = undefined
      const result = deepFreeze(value, mockLogger)
      expect(result).toBe(undefined)
    })
  })

  describe('simple objects', () => {
    it('freezes a simple object', () => {
      const obj = { name: 'test', value: 42 }
      const result = deepFreeze(obj, mockLogger)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('returns the same reference', () => {
      const obj = { name: 'test' }
      const result = deepFreeze(obj, mockLogger)
      expect(result).toBe(obj)
    })

    it('prevents property modification', () => {
      const obj = { name: 'test', value: 42 }
      const result = deepFreeze(obj, mockLogger)
      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen object
        result.name = 'modified'
      }).toThrow()
    })

    it('prevents property addition', () => {
      const obj = { name: 'test' }
      const result = deepFreeze(obj, mockLogger)
      expect(() => {
        // @ts-expect-error - intentionally trying to add to frozen object
        result.newProp = 'value'
      }).toThrow()
    })

    it('prevents property deletion', () => {
      const obj = { name: 'test', value: 42 }
      const result = deepFreeze(obj, mockLogger)
      expect(() => {
        // @ts-expect-error - intentionally trying to delete from frozen object
        delete result.name
      }).toThrow()
    })
  })

  describe('nested objects', () => {
    it('freezes nested objects', () => {
      const obj = {
        name: 'parent',
        child: {
          name: 'child',
          value: 42,
        },
      }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.child)).toBe(true)
    })

    it('prevents modification of nested properties', () => {
      const obj = {
        name: 'parent',
        settings: {
          debug: true,
          level: 1,
        },
      }
      const result = deepFreeze(obj, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen nested object
        result.settings.debug = false
      }).toThrow()
    })

    it('freezes deeply nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.level1)).toBe(true)
      expect(Object.isFrozen(result.level1.level2)).toBe(true)
      expect(Object.isFrozen(result.level1.level2.level3)).toBe(true)
    })

    it('prevents modification at any nesting level', () => {
      const obj = {
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      }
      const result = deepFreeze(obj, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify deeply frozen object
        result.a.b.c.d = 'modified'
      }).toThrow()
    })
  })

  describe('arrays', () => {
    it('freezes arrays', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('prevents array modification', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen array
        result[0] = 99
      }).toThrow()
    })

    it('prevents array mutation methods', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.push(4)
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.pop()
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.splice(0, 1)
      }).toThrow()
    })

    it('freezes arrays of objects', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result[0])).toBe(true)
      expect(Object.isFrozen(result[1])).toBe(true)
      expect(Object.isFrozen(result[2])).toBe(true)
    })

    it('prevents modification of objects within arrays', () => {
      const arr = [{ name: 'item1' }, { name: 'item2' }]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen object in array
        result[0].name = 'modified'
      }).toThrow()
    })

    it('freezes nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
        [5, 6],
      ]
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result[0])).toBe(true)
      expect(Object.isFrozen(result[1])).toBe(true)
      expect(Object.isFrozen(result[2])).toBe(true)
    })

    it('prevents modification of nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify nested frozen array
        result[0][0] = 99
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate nested frozen array
        result[0].push(3)
      }).toThrow()
    })
  })

  describe('mixed structures', () => {
    it('freezes objects containing arrays', () => {
      const obj = {
        name: 'config',
        items: [1, 2, 3],
        nested: {
          values: ['a', 'b', 'c'],
        },
      }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.items)).toBe(true)
      expect(Object.isFrozen(result.nested)).toBe(true)
      expect(Object.isFrozen(result.nested.values)).toBe(true)
    })

    it('prevents modification of arrays within objects', () => {
      const obj = {
        options: ['a', 'b', 'c'],
      }
      const result = deepFreeze(obj, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.options.push('d')
      }).toThrow()
    })

    it('freezes complex nested structures', () => {
      const complex = {
        name: 'app',
        settings: {
          debug: true,
          features: ['feature1', 'feature2'],
          options: {
            timeout: 1000,
            retries: [1, 2, 3],
          },
        },
        users: [
          { id: 1, roles: ['admin'] },
          { id: 2, roles: ['user', 'moderator'] },
        ],
      }
      const result = deepFreeze(complex, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.settings)).toBe(true)
      expect(Object.isFrozen(result.settings.features)).toBe(true)
      expect(Object.isFrozen(result.settings.options)).toBe(true)
      expect(Object.isFrozen(result.settings.options.retries)).toBe(true)
      expect(Object.isFrozen(result.users)).toBe(true)
      expect(Object.isFrozen(result.users[0])).toBe(true)
      expect(Object.isFrozen(result.users[0].roles)).toBe(true)
      expect(Object.isFrozen(result.users[1])).toBe(true)
      expect(Object.isFrozen(result.users[1].roles)).toBe(true)
    })

    it('prevents any modification in complex structures', () => {
      const complex = {
        data: {
          items: [{ value: 1 }, { value: 2 }],
        },
      }
      const result = deepFreeze(complex, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen object
        result.data.items[0].value = 99
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.data.items.push({ value: 3 })
      }).toThrow()
    })
  })

  describe('special cases', () => {
    it('handles empty objects', () => {
      const obj = {}
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(result).toBe(obj)
    })

    it('handles empty arrays', () => {
      const arr: unknown[] = []
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(result).toBe(arr)
    })

    it('handles objects with null values', () => {
      const obj = { value: null, data: { nested: null } }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.data)).toBe(true)
      expect(result.value).toBe(null)
      expect(result.data.nested).toBe(null)
    })

    it('handles objects with undefined values', () => {
      const obj = { value: undefined, data: { nested: undefined } }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.data)).toBe(true)
    })

    it('handles objects with mixed primitive and object values', () => {
      const obj = {
        string: 'text',
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
        object: { nested: 'value' },
        array: [1, 2, 3],
      }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.object)).toBe(true)
      expect(Object.isFrozen(result.array)).toBe(true)
    })

    it('handles Date objects', () => {
      const date = new Date('2024-01-01')
      const obj = { timestamp: date }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.timestamp)).toBe(true)
    })

    it('handles RegExp objects', () => {
      const regex = /test/i
      const obj = { pattern: regex }
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.pattern)).toBe(true)
    })

    it('freezes Map objects', () => {
      const map = new Map<string, string | { nested: string }>([
        ['key1', 'value1'],
        ['key2', { nested: 'value2' }],
      ])
      const result = deepFreeze(map, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('freezes Set objects', () => {
      const set = new Set([1, 2, 3, { id: 4 }])
      const result = deepFreeze(set, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('handles objects with circular references gracefully', () => {
      const obj: { name: string; self?: unknown } = { name: 'circular' }
      obj.self = obj

      // Should complete without infinite loop
      expect(() => {
        deepFreeze(obj, mockLogger)
      }).not.toThrow()
    })

    it('handles arrays with sparse elements', () => {
      const arr = [1, , 3, , 5] // eslint-disable-line no-sparse-arrays
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
      expect(result.length).toBe(5)
    })
  })

  describe('type safety', () => {
    it('preserves object structure in return type', () => {
      const obj = {
        name: 'test',
        value: 42,
        nested: {
          flag: true,
        },
      }
      const result = deepFreeze(obj, mockLogger)

      // These should be accessible (TypeScript compilation check)
      expect(result.name).toBe('test')
      expect(result.value).toBe(42)
      expect(result.nested.flag).toBe(true)
    })

    it('preserves array type information', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = deepFreeze(arr, mockLogger)

      // Should maintain array methods
      expect(result.length).toBe(5)
      expect(result.includes(3)).toBe(true)
      expect(result.indexOf(4)).toBe(3)
    })
  })

  describe('example from documentation', () => {
    it('matches the behavior described in JSDoc example', () => {
      const config = {
        name: 'app',
        settings: {
          debug: true,
          options: ['a', 'b'],
        },
      }

      const frozen = deepFreeze(config, mockLogger)

      // All modifications should throw
      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen object
        frozen.name = 'x'
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen nested object
        frozen.settings.debug = false
      }).toThrow()

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        frozen.settings.options.push('c')
      }).toThrow()

      // Values should remain unchanged
      expect(frozen.name).toBe('app')
      expect(frozen.settings.debug).toBe(true)
      expect(frozen.settings.options).toEqual(['a', 'b'])
    })
  })

  describe('mixed frozen/unfrozen structures', () => {
    it('freezes unfrozen children of frozen parents', () => {
      const unfrozenChild = { value: 'mutable' }
      const frozenParent = Object.freeze({ child: unfrozenChild })
      const root = { frozen: frozenParent }

      // Should NOT throw - the problematic case before the fix
      expect(() => deepFreeze(root, mockLogger)).not.toThrow()

      const result = deepFreeze(root, mockLogger)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.frozen.child)).toBe(true)
    })

    it('handles circular reference through frozen object', () => {
      const root: { child: { frozen?: object } } = { child: {} }
      const frozen = Object.freeze({ backToRoot: root })
      root.child.frozen = frozen

      // Should NOT throw and complete gracefully
      expect(() => deepFreeze(root, mockLogger)).not.toThrow()

      const result = deepFreeze(root, mockLogger)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.child)).toBe(true)
    })

    it('handles deeply nested mix of frozen and unfrozen with cycles', () => {
      const unfrozen1: { id: number; ref?: unknown } = { id: 1 }
      const unfrozen2: { id: number; ref?: unknown } = { id: 2 }
      const frozen = Object.freeze({ nested: unfrozen2 })
      unfrozen2.ref = unfrozen1

      const root = { a: unfrozen1, b: frozen }

      expect(() => deepFreeze(root, mockLogger)).not.toThrow()

      const result = deepFreeze(root, mockLogger)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.a)).toBe(true)
      expect(Object.isFrozen(result.b.nested)).toBe(true)
    })

    it('does not re-freeze already frozen objects', () => {
      const frozen = Object.freeze({ value: 'already frozen' })
      const obj = { frozen, unfrozen: { value: 'mutable' } }

      deepFreeze(obj, mockLogger)

      // logger.debug should not be called for freeze errors on already frozen objects
      // because we skip them entirely
      expect(Object.isFrozen(obj)).toBe(true)
      expect(Object.isFrozen(obj.unfrozen)).toBe(true)
    })
  })

  describe('graceful degradation', () => {
    it('freezes what it can when some nodes fail', () => {
      const obj = {
        normal: { value: 1 },
        anotherNormal: { value: 2 },
      }

      const result = deepFreeze(obj, mockLogger)

      // Should freeze successfully
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.normal)).toBe(true)
      expect(Object.isFrozen(result.anotherNormal)).toBe(true)
    })

    it('returns value even if primitives are passed', () => {
      expect(deepFreeze(42, mockLogger)).toBe(42)
      expect(deepFreeze('string', mockLogger)).toBe('string')
      expect(deepFreeze(null, mockLogger)).toBe(null)
      expect(deepFreeze(undefined, mockLogger)).toBe(undefined)
    })
  })

  describe('configuration options', () => {
    it('accepts maxDepth configuration', () => {
      const obj = {
        level1: {
          level2: {
            level3: { value: 'deep' },
          },
        },
      }

      const result = deepFreeze(obj, mockLogger, { maxDepth: 1 })

      // Root and level1 should be frozen (depth 0 and 1)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.level1)).toBe(true)
      // Deeper levels should NOT be frozen (depth 2+)
      expect(Object.isFrozen(result.level1.level2)).toBe(false)
    })

    it('uses sensible default maxDepth', () => {
      // Create deep structure within default limit
      let current: Record<string, unknown> = {}
      const root = current
      for (let i = 0; i < 50; i++) {
        current['child'] = {}
        current = <Record<string, unknown>>current['child']
      }

      const result = deepFreeze(root, mockLogger)

      // Should freeze all levels within default depth
      expect(Object.isFrozen(result)).toBe(true)

      // Check a few intermediate levels are frozen
      let check = <Record<string, Record<string, unknown>>>result
      for (let i = 0; i < 10; i++) {
        expect(Object.isFrozen(check)).toBe(true)
        check = <Record<string, Record<string, unknown>>>check['child']
      }
    })
  })

  describe('error handling edge cases', () => {
    it('logs and continues when freeze throws on a node', () => {
      // Create a proxy that throws when Object.freeze is attempted
      const throwingProxy = new Proxy(
        { value: 1 },
        {
          preventExtensions: () => {
            throw new Error('Cannot freeze this object')
          },
        }
      )

      const obj = {
        normal: { value: 'normal' },
        problematic: throwingProxy,
        anotherNormal: { value: 'also normal' },
      }

      // Should NOT throw, gracefully handles the failure
      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()

      // Logger should have been called with debug for the failed freeze
      expect(mockLogger.debug).toHaveBeenCalledWith('Failed to freeze node at depth', expect.any(Number), expect.any(Error))

      // Other nodes should still be frozen
      expect(Object.isFrozen(obj)).toBe(true)
      expect(Object.isFrozen(obj.normal)).toBe(true)
      expect(Object.isFrozen(obj.anotherNormal)).toBe(true)
    })

    it('logs and returns value when traversal fails completely', () => {
      // Create a pathological getter that throws during key enumeration
      const problematic = {
        get badProperty(): unknown {
          throw new Error('Property access error')
        },
      }

      // Define property with throwing getter
      const obj = Object.create(null)
      Object.defineProperty(obj, 'trap', {
        get: () => {
          throw new Error('Traversal trap triggered')
        },
        enumerable: true,
      })

      // Should NOT throw - graceful degradation
      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()

      // Should return the original value
      const result = deepFreeze(problematic, mockLogger)
      expect(result).toBe(problematic)
    })

    it('handles objects with non-configurable throwing getters', () => {
      const obj: Record<string, unknown> = { normal: { value: 1 } }
      Object.defineProperty(obj, 'throwing', {
        get: () => {
          throw new Error('Getter throws')
        },
        enumerable: true,
        configurable: false,
      })

      // Should not crash the program
      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()
    })

    it('handles revoked proxies gracefully', () => {
      const { proxy, revoke } = Proxy.revocable({ value: 1 }, {})
      const obj = { child: proxy }

      // Revoke the proxy before freezing
      revoke()

      // Should not throw - graceful degradation
      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()
    })
  })
})
