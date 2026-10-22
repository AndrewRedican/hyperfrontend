/** Generic callback function type */
// lint-disable-next-line typescript/no-explicit-any
export type Callback = (...args: any[]) => void

/** Function that removes a subscription when called */
export type Unsubscribe = () => void

/** Stack of callbacks that can be invoked together */
export interface Callstack<T extends Callback = Callback> {
  /** Number of callbacks in the stack */
  size: number
  /** Adds callbacks and returns an unsubscribe function */
  add: (...callbacks: T[]) => Unsubscribe
  /** Invokes all callbacks, optionally removing them after */
  call: (remove: boolean, ...args: unknown[]) => void
  /** Removes all callbacks from the stack */
  clear: () => void
}
