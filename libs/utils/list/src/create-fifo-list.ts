import { getType } from '@hyperfrontend/data-utils'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * A FIFO (First-In-First-Out) list interface.
 */
export interface FifoList<T extends object> {
  /** Adds an item to the end of the list */
  push(item: T): void
  /** Removes and returns the first item in the list, or undefined when the list is empty */
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
 * Creates a FIFO (First-In-First-Out) list.
 *
 * @template T The type of elements in the list, must be an object.
 * @returns {FifoList<T>} A FIFO list with methods to manipulate and query the list.
 * @example Creating and using FIFO queue
 * ```typescript
 * interface Task { id: number; name: string }
 * const queue = createFifoList<Task>()
 *
 * queue.push({ id: 1, name: 'first' })
 * queue.push({ id: 2, name: 'second' })
 *
 * queue.pull() // => { id: 1, name: 'first' }
 * queue.pull() // => { id: 2, name: 'second' }
 * queue.pull() // => undefined (the list is empty)
 * ```
 * @throws {Error} When the pushed item is a primitive rather than an object.
 * @throws {Error} When the pushed item is already in the list. Use has() to check first if a duplicate is expected.
 */
export function createFifoList<T extends object>(): FifoList<T> {
  const list: Set<T> = createSet()

  const push = (item: T): void => {
    if (getType(item) !== 'object') {
      throw createError('A fifo list only supports non-primitive values')
    }
    if (list.has(item)) {
      throw createError('Cannot push an item that already exists in the list')
    }
    list.add(item)
  }

  const pull = (): T | undefined => {
    const value = list.values().next().value
    list.delete(value as T)
    return value
  }

  const map = <U>(callback: (item: T) => U): U[] => {
    return from(list.values()).map(callback)
  }

  const forEach = (callback: (item: T) => void): void => {
    list.forEach(callback)
  }

  const remove = (item: T): boolean => list.delete(item)

  const has = (item: T): boolean => list.has(item)

  const size = () => list.size

  const clear = () => list.clear()

  const result: FifoList<T> = {
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
