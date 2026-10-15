import type { Action, State } from '../models'
import type { Listener } from './store.model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { rootReducer } from '../reducer/reducer'

/**
 * Redux-like store for managing state with dispatch and subscribe capabilities.
 *
 * @example Using the store
 * ```typescript
 * const store = new Store()
 * store.subscribe((state, action) => console.log('State:', state))
 * store.dispatch(start())
 * ```
 */
export class Store {
  private state = rootReducer(void 0, { type: '' })
  private listeners = createSet<Listener>()

  /**
   * Reduces an action into the state and notifies every subscriber.
   *
   * Listeners run synchronously before this returns, each receiving a fresh copy of the new
   * state together with the action that produced it, so none of them can mutate what the
   * store holds. An action no handler recognises leaves the state as it was but still
   * notifies the listeners.
   *
   * @param action - The action to reduce, as produced by the action creators
   */
  readonly dispatch = (action: Action): void => {
    this.state = rootReducer(this.state, action)
    this.listeners.forEach((listener) => listener(this.getState(), action))
  }

  /**
   * Reads the current state.
   *
   * @returns A shallow copy of the state, so a caller can inspect it without reaching into the store
   */
  readonly getState = (): State => ({ ...this.state })

  /**
   * Registers a listener for every dispatch that follows.
   *
   * The registry is a set, so a listener added twice is held once. It is not called with
   * the current state on registration; the first call comes with the next dispatch.
   *
   * @param listener - Called with the new state and the action after each dispatch
   * @returns A function that removes the listener; calling it more than once is harmless
   */
  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
