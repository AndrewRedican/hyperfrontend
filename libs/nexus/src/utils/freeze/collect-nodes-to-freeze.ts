import type { FreezeNode, DeepFreezeConfig } from './model'
import { isIterable, getType, getKeysFromIterable } from '@hyperfrontend/data-utils'
import { isFrozen } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createWeakSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set'

/** Default maximum traversal depth to prevent stack overflow */
const DEFAULT_MAX_DEPTH = 100

/**
 * Collects all iterable nodes in the data tree along with their depth.
 * Uses WeakSet-based cycle detection that works with frozen/sealed objects.
 * Skips nodes that are already frozen or have been visited (circular refs).
 * Returns nodes sorted by depth descending (deepest first) for bottom-up freezing.
 *
 * @param value - The root value to traverse
 * @param config - Optional configuration for traversal behavior
 * @returns Array of unfrozen nodes sorted by depth (deepest first)
 *
 * @example
 * ```typescript
 * const obj = { a: { b: { c: 1 } } }
 * const nodes = collectNodesToFreeze(obj)
 * // Returns: [{ value: {c:1}, depth: 2 }, { value: {b:{c:1}}, depth: 1 }, { value: obj, depth: 0 }]
 * ```
 */
export function collectNodesToFreeze(value: unknown, config: DeepFreezeConfig = {}): FreezeNode[] {
  const { maxDepth = DEFAULT_MAX_DEPTH } = config
  const nodesToFreeze: FreezeNode[] = []
  const visited = createWeakSet<object>()

  /**
   * Recursively visits nodes in the data tree.
   *
   * @param val - The current value being visited
   * @param depth - Current depth in the tree (0 = root)
   */
  function visit(val: unknown, depth: number): void {
    if (!isIterable(val)) return

    const obj = <object>val

    if (visited.has(obj)) return

    if (depth > maxDepth) return

    visited.add(obj)

    if (!isFrozen(obj)) {
      nodesToFreeze.push({ value: obj, depth })
    }

    const type = getType(val)
    const keys = getKeysFromIterable(val, type)
    for (const key of keys) {
      visit((<Record<string, unknown>>val)[key], depth + 1)
    }
  }

  visit(value, 0)

  return nodesToFreeze.sort((a, b) => b.depth - a.depth)
}
