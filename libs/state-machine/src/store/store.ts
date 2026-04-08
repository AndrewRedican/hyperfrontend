import type { Action, State } from '../models'
import type { Listener } from './store.model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { rootReducer } from '../reducer/reducer'

/**
 * Redux-like store for managing state with dispatch and subscribe capabilities.
 */
export class Store {
  private state = rootReducer(void 0, { type: '' })
  private listeners = createSet<Listener>()

  readonly dispatch = (action: Action): void => {
    this.state = rootReducer(this.state, action)
    this.listeners.forEach((listener) => listener(this.getState(), action))
  }

  readonly getState = (): State => ({ ...this.state })

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
