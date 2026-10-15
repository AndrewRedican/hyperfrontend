import type { DerivedState } from '../models'
import type { States, StateChangeHandler } from './state-change.model'

/**
 * Tracks state changes and notifies registered callbacks when state transitions occur.
 *
 * @example Tracking state transitions
 * ```typescript
 * const tracker = new StateChange()
 * tracker.registerCallback((prev, curr) => console.log('Changed:', prev, '->', curr))
 * tracker.addItem(newState)
 * ```
 */
export class StateChange {
  private states: States = [null, null]
  private callbacks: StateChangeHandler[] = []

  /**
   * Records a state as the current one, demoting the one before it to `previous`, and
   * notifies every registered callback.
   *
   * Only the two most recent states are kept; anything older is dropped. Callbacks run
   * synchronously, in registration order, before this returns.
   *
   * @param newState - The derived state that has just come into effect
   * @returns This tracker, so items and registrations can be chained
   */
  public readonly addItem = (newState: DerivedState): StateChange => {
    this.states = [this.states[1], newState]
    this.triggerCallbacks()
    return this
  }

  /**
   * Registers a callback for every transition that follows.
   *
   * The callback is not invoked for the states already recorded; its first call comes with
   * the next `addItem`. Registering the same callback twice runs it twice.
   *
   * @param callback - Called with the previous and the current snapshot after each `addItem`
   * @returns This tracker, so registrations can be chained
   */
  public readonly registerCallback = (callback: StateChangeHandler): StateChange => {
    this.callbacks.push(callback)
    return this
  }

  private readonly triggerCallbacks = (): void => {
    for (const callback of this.callbacks) {
      callback(this.previous, this.current)
    }
  }

  /**
   * The state before the most recent one, or `null` until two states have been recorded.
   *
   * @returns A copy of the previous snapshot, so reading it never exposes the tracker's own record
   */
  public get previous(): DerivedState | null {
    const snapshot = this.states[0]
    return snapshot ? { ...snapshot } : null
  }

  /**
   * The most recently recorded state, or `null` until the first `addItem`.
   *
   * @returns A copy of the current snapshot, so reading it never exposes the tracker's own record
   */
  public get current(): DerivedState | null {
    const snapshot = this.states[1]
    return snapshot ? { ...snapshot } : null
  }
}
