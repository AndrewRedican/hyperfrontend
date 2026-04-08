import type { Event, DerivedState } from '../models'
import { start, cancel, pause, success, fail } from '../actions/actions'
import { Events } from '../events/events'
import { AsyncProcess } from './async-operation.model'

/**
 * Manages the lifecycle of an asynchronous operation with start, cancel, and pause capabilities.
 *
 * @example
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

  constructor(process: AsyncProcess) {
    this.process = process
    this.events = new Events()
  }

  public readonly start = async (): Promise<void> => {
    this.events.dispatch(start())
    try {
      await this.process()
      this.events.dispatch(success())
    } catch (error) {
      this.events.dispatch(fail(error))
    }
  }

  public readonly cancel = (): void => {
    this.events.dispatch(cancel())
  }

  public readonly pause = (): void => {
    this.events.dispatch(pause())
  }

  public readonly on = (event: Event, handler: (event: Event, current: DerivedState, previous: DerivedState) => void): void => {
    this.events.on(event, handler)
  }
}
