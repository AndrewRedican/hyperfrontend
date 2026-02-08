import type { Action, State } from '../models'
import type { Listener } from './store.model'
import { rootReducer } from '../reducer/reducer'

export class Store {
  private state = rootReducer(void 0, { type: '' })
  private listeners = new Set<Listener>()

  readonly dispatch = (action: Action): void => {
    this.state = rootReducer(this.state, action)
    this.listeners.forEach((listener) => listener(this.getState(), action))
  }

  readonly getState = (): State => ({ ...this.state })

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners = new Set(Array.from(this.listeners.values()).filter((l) => l !== listener))
    }
  }
}
