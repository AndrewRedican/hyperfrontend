import type { FreezeNode } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { collectNodesToFreeze } from './collect-nodes-to-freeze'

/**
 * Names the objects the collected nodes reference, matching by identity rather than by shape, so one comparison pins exactly which objects were collected.
 *
 * @param nodes - The nodes collectNodesToFreeze returned.
 * @param named - The objects a failure message can name, keyed by that name.
 * @returns One name per node, 'unnamed' for an object outside `named`, sorted so traversal order does not matter.
 */
function collectedNames(nodes: FreezeNode[], named: Record<string, object>): string[] {
  const names = new Map<object, string>(Object.entries(named).map(([name, value]) => [value, name]))
  return nodes.map(({ value }) => names.get(value) ?? 'unnamed').sort()
}

describe('collectNodesToFreeze', () => {
  describe('simple objects', () => {
    it('collects root object at depth 0', () => {
      const obj = { name: 'test' }
      const result = collectNodesToFreeze(obj)

      expect({ nodes: collectedNames(result, { obj }), depth: result[0]?.depth }).toEqual({ nodes: ['obj'], depth: 0 })
    })

    it('collects root and nested object', () => {
      const obj = { child: { name: 'nested' } }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, child: obj.child })).toEqual(['child', 'obj'])
    })

    it('assigns correct depth to nested object', () => {
      const obj = { child: { name: 'nested' } }
      const result = collectNodesToFreeze(obj)

      const rootNode = result.find((n) => n.value === obj)
      const childNode = result.find((n) => n.value === obj.child)

      expect({ root: rootNode?.depth, child: childNode?.depth }).toEqual({ root: 0, child: 1 })
    })

    it('collects multiple nested objects', () => {
      const obj = {
        a: { value: 1 },
        b: { value: 2 },
      }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, a: obj.a, b: obj.b })).toEqual(['a', 'b', 'obj'])
    })
  })

  describe('deeply nested objects', () => {
    it('collects nodes at multiple depths', () => {
      const obj = {
        level1: {
          level2: {
            level3: { value: 'deep' },
          },
        },
      }
      const result = collectNodesToFreeze(obj)

      const depths = result.map((n) => n.depth).sort((a, b) => a - b)
      expect(depths).toEqual([0, 1, 2, 3])
    })

    it('assigns correct depths to nested objects', () => {
      const obj = {
        child: {
          grandchild: {},
        },
      }
      const result = collectNodesToFreeze(obj)

      const rootNode = result.find((n) => n.value === obj)
      const childNode = result.find((n) => n.value === obj.child)
      const grandchildNode = result.find((n) => n.value === obj.child.grandchild)

      expect({ root: rootNode?.depth, child: childNode?.depth, grandchild: grandchildNode?.depth }).toEqual({
        root: 0,
        child: 1,
        grandchild: 2,
      })
    })
  })

  describe('arrays', () => {
    it('collects root and nested array', () => {
      const obj = { items: [1, 2, 3] }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, items: obj.items })).toEqual(['items', 'obj'])
    })

    it('collects root and nested arrays within arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      const result = collectNodesToFreeze(arr)

      expect(collectedNames(result, { arr, first: arr[0], second: arr[1] })).toEqual(['arr', 'first', 'second'])
    })

    it('collects root array and objects within arrays', () => {
      const arr = [{ a: 1 }, { b: 2 }]
      const result = collectNodesToFreeze(arr)

      expect(collectedNames(result, { arr, first: arr[0], second: arr[1] })).toEqual(['arr', 'first', 'second'])
    })
  })

  describe('mixed structures', () => {
    it('collects all iterable nodes in complex structure', () => {
      const obj = {
        settings: {
          items: [{ id: 1 }, { id: 2 }],
        },
      }
      const result = collectNodesToFreeze(obj)

      expect(result).toHaveLength(5)
    })

    it('assigns correct depths in complex structure', () => {
      const obj = {
        config: {
          list: [{ nested: { deep: true } }],
        },
      }
      const result = collectNodesToFreeze(obj)

      const depths = result.map((n) => n.depth).sort((a, b) => a - b)
      expect(depths).toEqual([0, 1, 2, 3, 4])
    })
  })

  describe('primitive values', () => {
    it('returns empty array for primitive number', () => {
      const result = collectNodesToFreeze(42)

      expect(result).toHaveLength(0)
    })

    it('returns empty array for primitive string', () => {
      const result = collectNodesToFreeze('hello')

      expect(result).toHaveLength(0)
    })

    it('returns empty array for null', () => {
      const result = collectNodesToFreeze(null)

      expect(result).toHaveLength(0)
    })

    it('returns empty array for undefined', () => {
      const result = collectNodesToFreeze(undefined)

      expect(result).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty object (returns root only)', () => {
      const obj = {}
      const result = collectNodesToFreeze(obj)

      expect({ nodes: collectedNames(result, { obj }), depth: result[0]?.depth }).toEqual({ nodes: ['obj'], depth: 0 })
    })

    it('handles empty array (returns root only)', () => {
      const arr: unknown[] = []
      const result = collectNodesToFreeze(arr)

      expect({ nodes: collectedNames(result, { arr }), depth: result[0]?.depth }).toEqual({ nodes: ['arr'], depth: 0 })
    })

    it('handles object with null values', () => {
      const obj = { a: null, b: { c: null } }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, b: obj.b })).toEqual(['b', 'obj'])
    })

    it('handles sparse arrays', () => {
      const arr = [1, , 3] // eslint-disable-line no-sparse-arrays
      const wrapper = { arr }
      const result = collectNodesToFreeze(wrapper)

      expect(collectedNames(result, { wrapper, arr })).toEqual(['arr', 'wrapper'])
    })
  })

  describe('return value structure', () => {
    it('returns FreezeNode objects with value and depth', () => {
      const obj = { child: { name: 'test' } }
      const result = collectNodesToFreeze(obj)

      expect(result).toEqual([
        { value: expect.any(Object), depth: expect.any(Number) },
        { value: expect.any(Object), depth: expect.any(Number) },
      ])
    })

    it('value property references the actual objects', () => {
      const child = { name: 'test' }
      const obj = { child }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, child })).toEqual(['child', 'obj'])
    })

    it('depth is a non-negative integer', () => {
      const obj = { a: { b: { c: {} } } }
      const result = collectNodesToFreeze(obj)

      expect(result.filter((node) => !Number.isInteger(node.depth) || node.depth < 0)).toStrictEqual([])
    })
  })

  describe('circular references', () => {
    it('handles self-referential object without infinite loop', () => {
      const obj: { name: string; self?: unknown } = { name: 'circular' }
      obj.self = obj

      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj })).toEqual(['obj'])
    })

    it('handles mutual circular references', () => {
      const a: { name: string; ref?: unknown } = { name: 'a' }
      const b: { name: string; ref?: unknown } = { name: 'b' }
      a.ref = b
      b.ref = a

      const root = { a, b }
      const result = collectNodesToFreeze(root)

      expect(collectedNames(result, { root, a, b })).toEqual(['a', 'b', 'root'])
    })

    it('handles deeply nested circular reference', () => {
      const root: { child: { grandchild: { backToRoot?: unknown } } } = {
        child: {
          grandchild: {},
        },
      }
      root.child.grandchild.backToRoot = root

      const result = collectNodesToFreeze(root)

      expect(result).toHaveLength(3)
    })

    it('handles array with circular reference to parent', () => {
      const arr: unknown[] = [1, 2]
      arr.push(arr)

      const result = collectNodesToFreeze(arr)

      expect(collectedNames(result, { arr })).toEqual(['arr'])
    })
  })

  describe('already frozen objects', () => {
    it('skips already frozen nested object', () => {
      const frozen = Object.freeze({ value: 'frozen' })
      const obj = { child: frozen }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, frozen })).toEqual(['obj'])
    })

    it('skips already frozen root object', () => {
      const frozen = Object.freeze({ value: 'frozen' })
      const result = collectNodesToFreeze(frozen)

      expect(result).toHaveLength(0)
    })

    it('collects unfrozen branches alongside frozen ones', () => {
      const frozen = Object.freeze({ value: 'frozen' })
      const unfrozen = { value: 'unfrozen' }
      const obj = { frozen, unfrozen }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, frozen, unfrozen })).toEqual(['obj', 'unfrozen'])
    })

    it('traverses into frozen objects to find unfrozen descendants', () => {
      const unfrozenDeep = { value: 'unfrozen' }
      const frozen = Object.freeze({ child: unfrozenDeep })
      const obj = { frozen }
      const result = collectNodesToFreeze(obj)

      expect(collectedNames(result, { obj, frozen, unfrozenDeep })).toEqual(['obj', 'unfrozenDeep'])
    })
  })

  describe('mixed frozen/unfrozen with circular references', () => {
    it('handles circular reference through frozen object', () => {
      const root: { child: { frozen?: object } } = { child: {} }
      const frozen = Object.freeze({ backToRoot: root })
      root.child.frozen = frozen

      const result = collectNodesToFreeze(root)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('handles deeply nested mix of frozen and unfrozen with cycles', () => {
      const unfrozen1 = { id: 1 }
      const unfrozen2: { id: number; ref?: unknown } = { id: 2 }
      const frozen = Object.freeze({ nested: unfrozen2 })
      unfrozen2.ref = unfrozen1

      const root = { a: unfrozen1, b: frozen }

      const result = collectNodesToFreeze(root)
      expect(collectedNames(result, { root, frozen, unfrozen1, unfrozen2 })).toEqual(['root', 'unfrozen1', 'unfrozen2'])
    })
  })

  describe('depth limiting', () => {
    it('respects maxDepth configuration', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: { value: 'deep' },
            },
          },
        },
      }
      const result = collectNodesToFreeze(obj, { maxDepth: 2 })

      const depths = result.map((n) => n.depth).sort((a, b) => a - b)
      expect(depths).toEqual([0, 1, 2])
    })

    it('uses default maxDepth when not specified', () => {
      let current: Record<string, unknown> = {}
      const root = current
      for (let i = 0; i < 50; i++) {
        current['child'] = {}
        current = current['child'] as Record<string, unknown>
      }

      const result = collectNodesToFreeze(root)

      expect(result.length).toBe(51)
    })

    it('maxDepth of 0 only collects root', () => {
      const obj = { child: { grandchild: {} } }
      const result = collectNodesToFreeze(obj, { maxDepth: 0 })

      expect({ nodes: collectedNames(result, { obj }), depth: result[0]?.depth }).toEqual({ nodes: ['obj'], depth: 0 })
    })
  })

  describe('non-extensible objects', () => {
    it('handles frozen root with unfrozen children gracefully', () => {
      const unfrozen = { value: 'mutable' }
      const frozen = Object.freeze({ child: unfrozen })

      const result = collectNodesToFreeze(frozen)
      expect(collectedNames(result, { frozen, unfrozen })).toEqual(['unfrozen'])
    })

    it('handles Object.seal objects', () => {
      const sealed = Object.seal({ child: { value: 'nested' } })

      const result = collectNodesToFreeze(sealed)
      expect(result).toHaveLength(2)
    })

    it('handles Object.preventExtensions objects', () => {
      const nonExtensible = Object.preventExtensions({ child: { value: 'nested' } })

      const result = collectNodesToFreeze(nonExtensible)
      expect(result).toHaveLength(2)
    })
  })
})
