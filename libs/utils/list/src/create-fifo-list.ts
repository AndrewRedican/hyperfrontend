import { getType } from '@hyperfrontend/data-utils'

export interface FifoList<T extends object> {
  push(item: T): void
  pull(): T
  map<U>(callback: (item: T) => U): U[]
  forEach(callback: (item: T) => void): void
  remove(item: T): boolean
  has(item: T): boolean
  size(): number
  clear(): void
}

/**
 * Creates a FIFO (First-In-First-Out) list.
 *
 * @template T The type of elements in the list, must be an object.
 * @returns {FifoList<T>} A FIFO list with methods to manipulate and query the list.
 */
export function createFifoList<T extends object>(): FifoList<T> {
  const list: Set<T> = new Set()

  const push = (item: T): void => {
    if (getType(item) !== 'object') {
      throw new Error('A fifo list only non-primitive values')
    }
    if (list.has(item)) {
      throw new Error('Cannot a item that already exists')
    }
    list.add(item)
  }

  const pull = (): T => {
    const value = list.values().next().value
    list.delete(<T>value)
    return <T>value
  }

  const map = <U>(callback: (item: T) => U): U[] => {
    return Array.from(list.values()).map(callback)
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

  return Object.freeze(result)
}
