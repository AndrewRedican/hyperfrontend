import type { Logger } from '@hyperfrontend/logging'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { deepFreeze } from './deep-freeze'
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

/**
 * Lists the named nodes that are not frozen, so one comparison covers every level of a structure and a failure names the levels that stayed mutable.
 *
 * @param nodes - The nodes to inspect, keyed by the name a failure should show.
 * @returns The names of the nodes `Object.isFrozen` reports as not frozen, in the order given.
 */
function unfrozenNodes(nodes: Record<string, unknown>): string[] {
  return Object.entries(nodes)
    .filter(([, node]) => !Object.isFrozen(node))
    .map(([name]) => name)
}

/**
 * Attempts a mutation that a frozen target rejects and discards the resulting error, so a test can inspect the state the attempt leaves behind.
 *
 * @param mutate - The mutation to attempt.
 */
function attemptMutation(mutate: () => void): void {
  try {
    mutate()
  } catch {
    // note: whether the mutation throws is asserted by its own test; the caller only inspects the state that follows
  }
}

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
      channel: jest.fn(),
      timed: jest.fn(),
      timedAsync: jest.fn(),
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

      expect(unfrozenNodes({ root: result, child: result.child })).toEqual([])
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

      expect(
        unfrozenNodes({
          root: result,
          level1: result.level1,
          level2: result.level1.level2,
          level3: result.level1.level2.level3,
        })
      ).toEqual([])
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

    it('prevents array mutation through push', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.push(4)
      }).toThrow()
    })

    it('prevents array mutation through pop', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.pop()
      }).toThrow()
    })

    it('prevents array mutation through splice', () => {
      const arr = [1, 2, 3]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.splice(0, 1)
      }).toThrow()
    })

    it('freezes arrays of objects', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = deepFreeze(arr, mockLogger)

      expect(unfrozenNodes({ array: result, first: result[0], second: result[1], third: result[2] })).toEqual([])
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

      expect(unfrozenNodes({ outer: result, first: result[0], second: result[1], third: result[2] })).toEqual([])
    })

    it('prevents element assignment in nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      const result = deepFreeze(arr, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify nested frozen array
        result[0][0] = 99
      }).toThrow()
    })

    it('prevents push into nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      const result = deepFreeze(arr, mockLogger)

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

      expect(unfrozenNodes({ root: result, items: result.items, nested: result.nested, values: result.nested.values })).toEqual([])
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

      expect(
        unfrozenNodes({
          root: result,
          settings: result.settings,
          features: result.settings.features,
          options: result.settings.options,
          retries: result.settings.options.retries,
          users: result.users,
          firstUser: result.users[0],
          firstUserRoles: result.users[0].roles,
          secondUser: result.users[1],
          secondUserRoles: result.users[1].roles,
        })
      ).toEqual([])
    })

    it('prevents property assignment deep in complex structures', () => {
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
    })

    it('prevents array growth deep in complex structures', () => {
      const complex = {
        data: {
          items: [{ value: 1 }, { value: 2 }],
        },
      }
      const result = deepFreeze(complex, mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        result.data.items.push({ value: 3 })
      }).toThrow()
    })
  })

  describe('special cases', () => {
    it('freezes empty objects', () => {
      const obj = {}
      const result = deepFreeze(obj, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('returns the same empty object', () => {
      const obj = {}
      const result = deepFreeze(obj, mockLogger)

      expect(result).toBe(obj)
    })

    it('freezes empty arrays', () => {
      const arr: unknown[] = []
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('returns the same empty array', () => {
      const arr: unknown[] = []
      const result = deepFreeze(arr, mockLogger)

      expect(result).toBe(arr)
    })

    it('freezes objects with null values', () => {
      const obj = { value: null, data: { nested: null } }
      const result = deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: result, data: result.data })).toEqual([])
    })

    it('keeps null values in place', () => {
      const obj = { value: null, data: { nested: null } }
      const result = deepFreeze(obj, mockLogger)

      expect(result).toEqual({ value: null, data: { nested: null } })
    })

    it('handles objects with undefined values', () => {
      const obj = { value: undefined, data: { nested: undefined } }
      const result = deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: result, data: result.data })).toEqual([])
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

      expect(unfrozenNodes({ root: result, object: result.object, array: result.array })).toEqual([])
    })

    it('handles Date objects', () => {
      const date = new Date('2024-01-01')
      const obj = { timestamp: date }
      const result = deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: result, timestamp: result.timestamp })).toEqual([])
    })

    it('handles RegExp objects', () => {
      const regex = /test/i
      const obj = { pattern: regex }
      const result = deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: result, pattern: result.pattern })).toEqual([])
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

      expect(() => {
        deepFreeze(obj, mockLogger)
      }).not.toThrow()
    })

    it('freezes arrays with sparse elements', () => {
      const arr = [1, , 3, , 5] // lint-disable-line no-sparse-arrays
      const result = deepFreeze(arr, mockLogger)

      expect(Object.isFrozen(result)).toBe(true)
    })

    it('keeps the length of arrays with sparse elements', () => {
      const arr = [1, , 3, , 5] // lint-disable-line no-sparse-arrays
      const result = deepFreeze(arr, mockLogger)

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

      expect(result).toEqual({ name: 'test', value: 42, nested: { flag: true } })
    })

    it('preserves array type information', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = deepFreeze(arr, mockLogger)

      expect({ length: result.length, includesThree: result.includes(3), indexOfFour: result.indexOf(4) }).toEqual({
        length: 5,
        includesThree: true,
        indexOfFour: 3,
      })
    })
  })

  describe('example from documentation', () => {
    const documentedConfig = () => ({
      name: 'app',
      settings: {
        debug: true,
        options: ['a', 'b'],
      },
    })

    it('rejects reassigning a top-level property, as documented', () => {
      const frozen = deepFreeze(documentedConfig(), mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen object
        frozen.name = 'x'
      }).toThrow()
    })

    it('rejects reassigning a nested property, as documented', () => {
      const frozen = deepFreeze(documentedConfig(), mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to modify frozen nested object
        frozen.settings.debug = false
      }).toThrow()
    })

    it('rejects pushing into a nested array, as documented', () => {
      const frozen = deepFreeze(documentedConfig(), mockLogger)

      expect(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        frozen.settings.options.push('c')
      }).toThrow()
    })

    it('keeps the documented values after the rejected mutations', () => {
      const frozen = deepFreeze(documentedConfig(), mockLogger)

      attemptMutation(() => {
        // @ts-expect-error - intentionally trying to modify frozen object
        frozen.name = 'x'
      })
      attemptMutation(() => {
        // @ts-expect-error - intentionally trying to modify frozen nested object
        frozen.settings.debug = false
      })
      attemptMutation(() => {
        // @ts-expect-error - intentionally trying to mutate frozen array
        frozen.settings.options.push('c')
      })

      expect(frozen).toEqual({ name: 'app', settings: { debug: true, options: ['a', 'b'] } })
    })
  })

  describe('mixed frozen/unfrozen structures', () => {
    it('freezes unfrozen children of frozen parents', () => {
      const unfrozenChild = { value: 'mutable' }
      const frozenParent = Object.freeze({ child: unfrozenChild })
      const root = { frozen: frozenParent }

      const result = deepFreeze(root, mockLogger)
      expect(unfrozenNodes({ root: result, child: result.frozen.child })).toEqual([])
    })

    it('handles circular reference through frozen object', () => {
      const root: { child: { frozen?: object } } = { child: {} }
      const frozen = Object.freeze({ backToRoot: root })
      root.child.frozen = frozen

      const result = deepFreeze(root, mockLogger)
      expect(unfrozenNodes({ root: result, child: result.child })).toEqual([])
    })

    it('handles deeply nested mix of frozen and unfrozen with cycles', () => {
      const unfrozen1: { id: number; ref?: unknown } = { id: 1 }
      const unfrozen2: { id: number; ref?: unknown } = { id: 2 }
      const frozen = Object.freeze({ nested: unfrozen2 })
      unfrozen2.ref = unfrozen1

      const root = { a: unfrozen1, b: frozen }

      const result = deepFreeze(root, mockLogger)
      expect(unfrozenNodes({ root: result, a: result.a, nested: result.b.nested })).toEqual([])
    })

    it('does not re-freeze already frozen objects', () => {
      const frozen = Object.freeze({ value: 'already frozen' })
      const obj = { frozen, unfrozen: { value: 'mutable' } }

      deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: obj, unfrozenChild: obj.unfrozen })).toEqual([])
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

      expect(unfrozenNodes({ root: result, level1: result.level1, level2: result.level1.level2 })).toEqual(['level2'])
    })

    it('uses sensible default maxDepth', () => {
      let current: Record<string, unknown> = {}
      const root = current
      for (let i = 0; i < 50; i++) {
        current['child'] = {}
        current = current['child'] as Record<string, unknown>
      }

      const result = deepFreeze(root, mockLogger)

      let check = result as Record<string, Record<string, unknown>>
      for (let i = 0; i < 10; i++) {
        expect(Object.isFrozen(check)).toBe(true)
        check = check['child'] as Record<string, Record<string, unknown>>
      }
    })
  })
})
