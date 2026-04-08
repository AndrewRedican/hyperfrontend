import type { DerivedState } from '../models'
import type { States, StateChangeHandler } from './state-change.model'

/**
 * Tracks state changes and notifies registered callbacks when state transitions occur.
 *
 * @example
 * ```typescript
 * const tracker = new StateChange()
 * tracker.registerCallback((prev, curr) => console.log('Changed:', prev, '->', curr))
 * tracker.addItem(newState)
 * ```
 */
export class StateChange {
  private states: States = [null, null]
  private callbacks: StateChangeHandler[] = []

  public readonly addItem = (newState: DerivedState): StateChange => {
    this.states = [this.states[1], newState]
    this.triggerCallbacks()
    return this
  }

  public readonly registerCallback = (callback: StateChangeHandler): StateChange => {
    this.callbacks.push(callback)
    return this
  }

  private readonly triggerCallbacks = (): void => {
    for (const callback of this.callbacks) {
      callback(this.previous, this.current)
    }
  }

  public get previous(): DerivedState | null {
    const snapshot = this.states[0]
    return snapshot ? { ...snapshot } : null
  }

  public get current(): DerivedState | null {
    const snapshot = this.states[1]
    return snapshot ? { ...snapshot } : null
  }
}
