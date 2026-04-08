import type { Callstack, Callback } from './call-stack.model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Creates a call stack for managing callback functions.
 *
 * @returns A Callstack instance for adding, calling, and clearing callbacks
 *
 * @example
 * ```typescript
 * const stack = callStack<(value: number) => void>()
 * const unsubscribe = stack.add((v) => console.log(v))
 * stack.call(false, [42]) // logs: 42
 * unsubscribe()
 * ```
 */
export const callStack = <T extends Callback = Callback>(): Callstack<T> => {
  const stack = createSet<T>()
  const add = (callbacks: T[]) => {
    callbacks.forEach((cb) => {
      if (getType(cb) !== 'function') {
        throw createError('Cannot add items that are not functions.')
      }
    })
    const notRegistered = callbacks.filter((cb) => !stack.has(cb))
    const unsubscribe = () => notRegistered.forEach((cb) => stack.delete(cb))
    callbacks.forEach((cb) => stack.add(cb))
    return unsubscribe
  }
  const clear = () => stack.clear()
  const call = (remove: boolean, args: unknown[]) => {
    stack.forEach((cb) => cb(...args))
    if (remove) clear()
  }
  return {
    get size(): number {
      return stack.size
    },
    get add(): Callstack<T>['add'] {
      return (...callbacks) => add(callbacks)
    },
    get call(): Callstack<T>['call'] {
      return (remove, ...args) => call(remove, args)
    },
    get clear(): Callstack<T>['clear'] {
      return () => clear()
    },
  }
}
