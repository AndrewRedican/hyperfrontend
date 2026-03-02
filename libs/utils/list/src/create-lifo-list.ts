import { getType } from '@hyperfrontend/data-utils'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

export interface LifoList<T extends object> {
  push(item: T): void
  pull(): T | undefined
  map<U>(callback: (item: T) => U): U[]
  forEach(callback: (item: T) => void): void
  remove(item: T): boolean
  has(item: T): boolean
  size(): number
  clear(): void
}

/**
 * Creates a LIFO (Last-In-First-Out) list.
 *
 * @template T The type of elements in the list, must be an object.
 * @returns {LifoList<T>} A LIFO list with methods to manipulate and query the list.
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
