import { getType } from '@hyperfrontend/data-utils'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * A LIFO (Last-In-First-Out) list interface.
 */
export interface LifoList<T extends object> {
  /** Adds an item to the list */
  push(item: T): void
  /** Removes and returns the last item in the list */
  pull(): T | undefined
  /** Maps each item using the provided callback */
  map<U>(callback: (item: T) => U): U[]
  /** Iterates over each item in the list */
  forEach(callback: (item: T) => void): void
  /** Removes a specific item from the list */
  remove(item: T): boolean
  /** Checks if an item exists in the list */
  has(item: T): boolean
  /** Returns the number of items in the list */
  size(): number
  /** Removes all items from the list */
  clear(): void
}

/**
 * Creates a LIFO (Last-In-First-Out) list.
 *
 * @template T The type of elements in the list, must be an object.
 * @returns {LifoList<T>} A LIFO list with methods to manipulate and query the list.
 * @example
 * ```typescript
 * interface HistoryEntry { url: string; timestamp: number }
 * const history = createLifoList<HistoryEntry>()
 *
 * history.push({ url: '/home', timestamp: 1 })
 * history.push({ url: '/about', timestamp: 2 })
 *
 * history.pull() // => { url: '/about', timestamp: 2 }
 * history.pull() // => { url: '/home', timestamp: 1 }
 * ```
 */
export function createLifoList<T extends object>(): LifoList<T> {
  const list: Set<T> = createSet()

  const push = (item: T): void => {
    if (getType(item) !== 'object') {
      throw createError('A lifo list only supports non-primitive values')
    }
    list.add(item)
  }

  const pull = (): T | undefined => {
    const lastItem = from(list).pop()
    if (lastItem) {
      list.delete(lastItem)
    }
    return lastItem
  }

  const map = <U>(callback: (item: T) => U): U[] => {
    return from(list).map(callback)
  }

  const forEach = (callback: (item: T) => void): void => {
    list.forEach(callback)
  }

  const remove = (item: T): boolean => list.delete(item)

  const has = (item: T): boolean => list.has(item)

  const size = (): number => list.size

  const clear = (): void => {
    list.clear()
  }

  const result: LifoList<T> = {
    push,
    pull,
    map,
    forEach,
    remove,
    has,
    size,
    clear,
  }

  return freeze(result)
}
