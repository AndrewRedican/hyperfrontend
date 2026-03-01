import { collectNodesToFreeze } from './collect-nodes-to-freeze'

describe('collectNodesToFreeze', () => {
  describe('simple objects', () => {
    it('collects root object at depth 0', () => {
      const obj = { name: 'test' }
      const result = collectNodesToFreeze(obj)

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(obj)
      expect(result[0].depth).toBe(0)
    })

    it('collects root and nested object', () => {
      const obj = { child: { name: 'nested' } }
      const result = collectNodesToFreeze(obj)

      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(obj.child)
    })

    it('assigns correct depth to nested object', () => {
      const obj = { child: { name: 'nested' } }
      const result = collectNodesToFreeze(obj)

      const rootNode = result.find((n) => n.value === obj)
      const childNode = result.find((n) => n.value === obj.child)

      expect(rootNode?.depth).toBe(0)
      expect(childNode?.depth).toBe(1)
    })

    it('collects multiple nested objects', () => {
      const obj = {
        a: { value: 1 },
        b: { value: 2 },
      }
      const result = collectNodesToFreeze(obj)

      // root + 2 children
      expect(result).toHaveLength(3)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(obj.a)
      expect(result.map((n) => n.value)).toContain(obj.b)
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

      // root (0) + level1 (1) + level2 (2) + level3 (3)
      expect(result).toHaveLength(4)

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

      expect(rootNode?.depth).toBe(0)
      expect(childNode?.depth).toBe(1)
      expect(grandchildNode?.depth).toBe(2)
    })
  })

  describe('arrays', () => {
    it('collects root and nested array', () => {
      const obj = { items: [1, 2, 3] }
      const result = collectNodesToFreeze(obj)

      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(obj.items)
    })

    it('collects root and nested arrays within arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ]
      const result = collectNodesToFreeze(arr)

      // root array + 2 inner arrays
      expect(result).toHaveLength(3)
      expect(result.map((n) => n.value)).toContain(arr)
      expect(result.map((n) => n.value)).toContain(arr[0])
      expect(result.map((n) => n.value)).toContain(arr[1])
    })

    it('collects root array and objects within arrays', () => {
      const arr = [{ a: 1 }, { b: 2 }]
      const result = collectNodesToFreeze(arr)

      // root array + 2 objects
      expect(result).toHaveLength(3)
      expect(result.map((n) => n.value)).toContain(arr)
      expect(result.map((n) => n.value)).toContain(arr[0])
      expect(result.map((n) => n.value)).toContain(arr[1])
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

      // root (0), settings (1), items (2), {id:1} (3), {id:2} (3)
      expect(result).toHaveLength(5)
    })

    it('assigns correct depths in complex structure', () => {
      const obj = {
        config: {
          list: [{ nested: { deep: true } }],
        },
      }
      const result = collectNodesToFreeze(obj)

      // root: 0, config: 1, list: 2, {nested:...}: 3, {deep:true}: 4
      expect(result).toHaveLength(5)

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

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(obj)
      expect(result[0].depth).toBe(0)
    })

    it('handles empty array (returns root only)', () => {
      const arr: unknown[] = []
      const result = collectNodesToFreeze(arr)

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(arr)
      expect(result[0].depth).toBe(0)
    })

    it('handles object with null values', () => {
      const obj = { a: null, b: { c: null } }
      const result = collectNodesToFreeze(obj)

      // root + obj.b
      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(obj.b)
    })

    it('handles sparse arrays', () => {
      const arr = [1, , 3] // eslint-disable-line no-sparse-arrays
      const wrapper = { arr }
      const result = collectNodesToFreeze(wrapper)

      // root wrapper + nested array
      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(wrapper)
      expect(result.map((n) => n.value)).toContain(arr)
    })
  })

  describe('return value structure', () => {
    it('returns FreezeNode objects with value and depth', () => {
      const obj = { child: { name: 'test' } }
      const result = collectNodesToFreeze(obj)

      expect(result.length).toBeGreaterThanOrEqual(1)
      result.forEach((node) => {
        expect(node).toHaveProperty('value')
        expect(node).toHaveProperty('depth')
      })
    })

    it('value property references the actual objects', () => {
      const child = { name: 'test' }
      const obj = { child }
      const result = collectNodesToFreeze(obj)

      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(child)
    })

    it('depth is a non-negative integer', () => {
      const obj = { a: { b: { c: {} } } }
      const result = collectNodesToFreeze(obj)

      result.forEach((node) => {
        expect(Number.isInteger(node.depth)).toBe(true)
        expect(node.depth).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('circular references', () => {
    it('handles self-referential object without infinite loop', () => {
      const obj: { name: string; self?: unknown } = { name: 'circular' }
      obj.self = obj

      const result = collectNodesToFreeze(obj)

      // Should only collect the object once
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(obj)
    })

    it('handles mutual circular references', () => {
      const a: { name: string; ref?: unknown } = { name: 'a' }
      const b: { name: string; ref?: unknown } = { name: 'b' }
      a.ref = b
      b.ref = a

      const root = { a, b }
      const result = collectNodesToFreeze(root)

      // root + a + b (each once)
      expect(result).toHaveLength(3)
      expect(result.map((n) => n.value)).toContain(root)
      expect(result.map((n) => n.value)).toContain(a)
      expect(result.map((n) => n.value)).toContain(b)
    })

    it('handles deeply nested circular reference', () => {
      const root: { child: { grandchild: { backToRoot?: unknown } } } = {
        child: {
          grandchild: {},
        },
      }
      root.child.grandchild.backToRoot = root

      const result = collectNodesToFreeze(root)

      // root + child + grandchild (each once)
      expect(result).toHaveLength(3)
    })

    it('handles array with circular reference to parent', () => {
      const arr: unknown[] = [1, 2]
      arr.push(arr) // arr[2] = arr

      const result = collectNodesToFreeze(arr)

      // Only the array itself, collected once
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(arr)
    })
  })

  describe('already frozen objects', () => {
    it('skips already frozen nested object', () => {
      const frozen = Object.freeze({ value: 'frozen' })
      const obj = { child: frozen }
      const result = collectNodesToFreeze(obj)

      // Only root (child is already frozen)
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(obj)
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

      // root + unfrozen
      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(unfrozen)
      expect(result.map((n) => n.value)).not.toContain(frozen)
    })

    it('traverses into frozen objects to find unfrozen descendants', () => {
      const unfrozenDeep = { value: 'unfrozen' }
      const frozen = Object.freeze({ child: unfrozenDeep })
      const obj = { frozen }
      const result = collectNodesToFreeze(obj)

      // root + unfrozenDeep (frozen is skipped but its children are visited)
      expect(result).toHaveLength(2)
      expect(result.map((n) => n.value)).toContain(obj)
      expect(result.map((n) => n.value)).toContain(unfrozenDeep)
    })
  })

  describe('mixed frozen/unfrozen with circular references', () => {
    it('handles circular reference through frozen object', () => {
      const root: { child: { frozen?: object } } = { child: {} }
      const frozen = Object.freeze({ backToRoot: root })
      root.child.frozen = frozen

      // This should NOT throw and should handle gracefully
      expect(() => collectNodesToFreeze(root)).not.toThrow()

      const result = collectNodesToFreeze(root)
      // root + child (frozen is skipped, backToRoot is circular back to root)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('handles deeply nested mix of frozen and unfrozen with cycles', () => {
      const unfrozen1 = { id: 1 }
      const unfrozen2: { id: number; ref?: unknown } = { id: 2 }
      const frozen = Object.freeze({ nested: unfrozen2 })
      unfrozen2.ref = unfrozen1

      const root = { a: unfrozen1, b: frozen }

      expect(() => collectNodesToFreeze(root)).not.toThrow()

      const result = collectNodesToFreeze(root)
      expect(result.map((n) => n.value)).toContain(root)
      expect(result.map((n) => n.value)).toContain(unfrozen1)
      expect(result.map((n) => n.value)).toContain(unfrozen2)
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

      // Only root (0), level1 (1), level2 (2) - stops before 3+
      expect(result).toHaveLength(3)
      const depths = result.map((n) => n.depth)
      expect(Math.max(...depths)).toBeLessThanOrEqual(2)
    })

    it('uses default maxDepth when not specified', () => {
      // Create a structure deeper than typical but less than default (100)
      let current: Record<string, unknown> = {}
      const root = current
      for (let i = 0; i < 50; i++) {
        current['child'] = {}
        current = <Record<string, unknown>>current['child']
      }

      const result = collectNodesToFreeze(root)

      // Should collect all 51 nodes (depth 0-50)
      expect(result.length).toBe(51)
    })

    it('maxDepth of 0 only collects root', () => {
      const obj = { child: { grandchild: {} } }
      const result = collectNodesToFreeze(obj, { maxDepth: 0 })

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(obj)
      expect(result[0].depth).toBe(0)
    })
  })

  describe('non-extensible objects', () => {
    it('handles frozen root with unfrozen children gracefully', () => {
      const unfrozen = { value: 'mutable' }
      const frozen = Object.freeze({ child: unfrozen })

      // This was the problematic case - should work with WeakSet approach
      expect(() => collectNodesToFreeze(frozen)).not.toThrow()

      const result = collectNodesToFreeze(frozen)
      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(unfrozen)
    })

    it('handles Object.seal objects', () => {
      const sealed = Object.seal({ child: { value: 'nested' } })

      expect(() => collectNodesToFreeze(sealed)).not.toThrow()

      const result = collectNodesToFreeze(sealed)
      // Both sealed parent and unfrozen child should be collected
      expect(result).toHaveLength(2)
    })

    it('handles Object.preventExtensions objects', () => {
      const nonExtensible = Object.preventExtensions({ child: { value: 'nested' } })

      expect(() => collectNodesToFreeze(nonExtensible)).not.toThrow()

      const result = collectNodesToFreeze(nonExtensible)
      expect(result).toHaveLength(2)
    })
  })
})
