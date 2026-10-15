import type { Event, DerivedState } from '../models'
import type { AsyncProcess } from './async-operation.model'
import { start, cancel, pause, success, fail } from '../actions/actions'
import { Events } from '../events/events'

/**
 * Manages the lifecycle of an asynchronous operation with start, cancel, and pause capabilities.
 *
 * @example Starting an async operation
 * ```typescript
 * const operation = new AsyncOperation(async () => {
 *   await fetchData()
 * })
 * operation.start()
 * ```
 */
export class AsyncOperation {
  private events: Events
  private process: AsyncProcess

  /**
   * Wraps a process so its progress can be observed as state-machine events.
   *
   * Nothing runs until `start` is called.
   *
   * @param process - The asynchronous work to manage; its returned promise decides success or failure
   */
  constructor(process: AsyncProcess) {
    this.process = process
    this.events = new Events()
  }

  /**
   * Runs the process once, dispatching the start action before it and success or fail after.
   *
   * A rejection is caught and reported as a failure carrying the thrown value, so the returned
   * promise never rejects. Calling `start` again runs the process again, and the events
   * describe the rerun as a retry or a restart depending on how the previous run ended.
   *
   * @returns Resolves once the process has settled and its outcome has been dispatched
   */
  public readonly start = async (): Promise<void> => {
    this.events.dispatch(start())
    try {
      await this.process()
      this.events.dispatch(success())
    } catch (error) {
      this.events.dispatch(fail(error))
    }
  }

  /**
   * Dispatches the cancel action, which leaves the state halted and no longer in progress.
   *
   * The promise returned by the process is not interrupted: the work keeps running, and
   * whatever it settles with is still dispatched afterwards. Cancellation is a state the
   * operation's observers see, not a signal the process receives.
   */
  public readonly cancel = (): void => {
    this.events.dispatch(cancel())
  }

  /**
   * Dispatches the pause action, which marks the state halted while still in progress.
   *
   * As with `cancel`, the process itself is not suspended; only the observable state changes.
   */
  public readonly pause = (): void => {
    this.events.dispatch(pause())
  }

  /**
   * Registers a handler for one of the operation's lifecycle events.
   *
   * @param event - Which state transition to listen for, one of the `event` constants
   * @param handler - Called with the event name, the state after the transition and the state before it
   */
  public readonly on = (event: Event, handler: (event: Event, current: DerivedState, previous: DerivedState) => void): void => {
    this.events.on(event, handler)
  }
}
