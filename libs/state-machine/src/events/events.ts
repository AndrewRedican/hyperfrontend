import type { StateChangeHandler } from '../state-change/state-change.model'
import type { DataPointSelector, EventHandler } from './events.model'
import type { Event, DerivedState } from '../models'
import { event } from '../models'
import { Store } from '../store/store'
import { StateChange } from '../state-change'
import { derivedState } from '../selectors'

export class Events {
  private readonly store = new Store()
  private readonly change = new StateChange()
  private readonly eventHandlers = new Set<[Event, EventHandler]>()

  constructor() {
    this.change.registerCallback(this.onStateChange)
    this.store.subscribe((state) => this.change.addItem(derivedState(state)))
  }

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

  public readonly dispatch: Store['dispatch'] = (action) => {
    this.store.dispatch(action)
  }
}
