import type { Action, Event, DerivedState } from '../models'
import type { StateChangeHandler } from '../state-change/state-change.model'
import type { DataPointSelector, EventHandler } from './events.model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { event } from '../models'
import { derivedState } from '../selectors'
import { StateChange } from '../state-change'
import { Store } from '../store/store'

/**
 * Event system that tracks state changes and dispatches events to registered handlers.
 *
 * @example Registering event handlers
 * ```typescript
 * const events = new Events()
 * events.on(event.Done, () => console.log('Operation completed'))
 * events.dispatch(success())
 * ```
 */
export class Events {
  private readonly store = new Store()
  private readonly change = new StateChange()
  private readonly eventHandlers = createSet<[Event, EventHandler]>()

  constructor() {
    this.change.registerCallback(this.onStateChange)
    this.store.subscribe((state) => this.change.addItem(derivedState(state)))
  }

  /**
   * Registers a handler for one event name.
   *
   * The handler runs each time the matching derived-state flag turns on, so it fires on
   * every transition into that state rather than once. Registration is additive: a handler
   * registered twice runs twice, and nothing is deduplicated.
   *
   * @param event - Which state transition to listen for, one of the `event` constants
   * @param eventHandler - Called with the event name, the state after the transition and the state before it
   */
  public readonly on = (event: Event, eventHandler: EventHandler): void => {
    this.eventHandlers.add([event, eventHandler])
  }

  private readonly onStateChange: StateChangeHandler = (): void => {
    this.onActivated((s) => s.notStarted, event.NotStarted)
    this.onActivated((s) => s.inProgress, event.InProgress)
    this.onActivated((s) => s.done, event.Done)
    this.onActivated((s) => s.successful, event.Successful)
    this.onActivated((s) => s.failed, event.Failed)
    this.onActivated((s) => s.retrying, event.Retrying)
    this.onActivated((s) => s.restarting, event.Restarting)
    this.onActivated((s) => s.paused, event.Paused)
    this.onActivated((s) => s.cancelled, event.Cancelled)
  }

  private readonly onActivated = (selector: DataPointSelector, event: Event) => {
    const getValue = (state: DerivedState | null): boolean => (state ? selector(state) : false)
    if (!getValue(this.change.previous) && getValue(this.change.current)) {
      this.invokeHandlers(event)
    }
  }

  private readonly invokeHandlers = (event: Event): void => {
    for (const [targetEvent, handler] of this.eventHandlers) {
      if (targetEvent === event) {
        handler(event, this.change.current as DerivedState, this.change.previous as DerivedState)
      }
    }
  }

  /**
   * Reduces an action into the internal store and dispatches the events the resulting
   * state change implies.
   *
   * Handlers run synchronously before this call returns, once for every event whose flag
   * went from off to on, in the order the events are declared and then in registration
   * order. An action that leaves the derived state unchanged fires nothing.
   *
   * @param action - The action to reduce, as produced by the action creators
   */
  public readonly dispatch = (action: Action): void => {
    this.store.dispatch(action)
  }
}
