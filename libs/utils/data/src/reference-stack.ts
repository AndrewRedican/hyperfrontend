import type { UnknownIterable, UnknownIterableKey, ReferenceStack } from './models'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isIterable } from './is-iterable'
import { marker } from './marker'

/**
 * Creates a new ReferenceStack instance.
 *
 * @remarks
 * A ReferenceStack is used to keep track of iterables that have already been processed.
 * This is particularly useful for handling circular references in data structures.
 * @returns A new ReferenceStack instance.
 *
 * @example Tracking object references
 * ```typescript
 * const stack = referenceStack()
 * stack.add(myObject)
 * stack.exists(myObject) // true
 * ```
 */
export const referenceStack = (): ReferenceStack => {
  const records = createMap<symbol, [UnknownIterableKey, UnknownIterable, number]>()
  const flag = marker() as UnknownIterableKey

  const exists = (ref: UnknownIterable): boolean => (isIterable(ref) ? flag in ref && records.has(ref[flag]) : false)

  const add = (ref: UnknownIterable): void => {
    if (!isIterable(ref) || exists(ref)) return
    ;(ref[flag] as symbol) = Symbol()
    records.set(ref[flag], [flag, ref, records.size])
  }

  const lastSeen = (ref: UnknownIterable): number | null => {
    if (!isIterable(ref)) return null
    const record = records.get(ref[flag])
    return record ? record[2] - records.size : null
  }

  const clear = () => (
    records.forEach(([key, ref]) => {
      delete ref[key]
    }),
    records.clear()
  )

  return {
    add: (ref) => add(ref as UnknownIterable),
    exists: (ref) => exists(ref as UnknownIterable),
    lastSeen: (ref) => lastSeen(ref as UnknownIterable),
    clear: () => clear(),
    get size() {
      return records.size
    },
  }
}
