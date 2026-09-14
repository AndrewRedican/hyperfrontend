import type { UnknownIterable, ReferenceStack } from './models'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isIterable } from './is-iterable'

/**
 * Creates a new ReferenceStack instance.
 *
 * @remarks
 * A ReferenceStack keeps track of the iterables on the path from the root down to the value currently
 * being processed. A walker adds a value before visiting its children and removes it once they are done,
 * which is what tells a genuine cycle (the value is an ancestor of itself) apart from a reference that is
 * merely shared between two branches. References are tracked by identity, so the caller's data is never
 * written to and frozen or sealed values are tracked like any other.
 * @returns A new ReferenceStack instance.
 *
 * @example Tracking object references
 * ```typescript
 * const stack = referenceStack()
 * stack.add(myObject)
 * stack.exists(myObject) // true
 * stack.remove(myObject)
 * stack.exists(myObject) // false
 * ```
 */
export const referenceStack = (): ReferenceStack => {
  const records = createMap<UnknownIterable, number>()

  const exists = (ref: UnknownIterable): boolean => records.has(ref)

  const add = (ref: UnknownIterable): void => {
    if (!isIterable(ref) || exists(ref)) return
    records.set(ref, records.size)
  }

  const lastSeen = (ref: UnknownIterable): number | null => {
    const index = records.get(ref)
    return index === undefined ? null : index - records.size
  }

  const remove = (ref: UnknownIterable): void => {
    records.delete(ref)
  }

  return {
    add: (ref) => add(ref as UnknownIterable),
    exists: (ref) => exists(ref as UnknownIterable),
    lastSeen: (ref) => lastSeen(ref as UnknownIterable),
    remove: (ref) => remove(ref as UnknownIterable),
    clear: () => records.clear(),
    get size() {
      return records.size
    },
  }
}
