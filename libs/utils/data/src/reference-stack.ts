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
 * @example
 * ```typescript
 * const stack = referenceStack()
 * stack.add(myObject)
 * stack.exists(myObject) // true
 * ```
 */
export const referenceStack = (): ReferenceStack => {
  const records = createMap<symbol, [UnknownIterableKey, UnknownIterable, number]>()
  const flag = <UnknownIterableKey>marker()

  const exists = (ref: UnknownIterable): boolean => (isIterable(ref) ? flag in ref && records.has(ref[flag]) : false)

  const add = (ref: UnknownIterable): void => {
    if (!isIterable(ref) || exists(ref)) return
    ;(<symbol>ref[flag]) = Symbol()
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
    add: (ref) => add(<UnknownIterable>ref),
    exists: (ref) => exists(<UnknownIterable>ref),
    lastSeen: (ref) => lastSeen(<UnknownIterable>ref),
    clear: () => clear(),
    get size() {
      return records.size
    },
  }
}
