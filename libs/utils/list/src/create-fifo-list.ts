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
  /** Removes and returns the first item in the list */
  pull(): T
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
 */
export function createFifoList<T extends object>(): FifoList<T> {
  const list: Set<T> = createSet()

  const push = (item: T): void => {
    if (getType(item) !== 'object') {
      throw createError('A fifo list only non-primitive values')
    }
    if (list.has(item)) {
      throw createError('Cannot a item that already exists')
    }
    list.add(item)
  }

  const pull = (): T => {
    const value = list.values().next().value
    list.delete(<T>value)
    return <T>value
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
