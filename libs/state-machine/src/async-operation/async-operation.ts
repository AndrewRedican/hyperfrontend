/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events } from '../events/events'
import type { Event, DerivedState } from '../models'
import { start, cancel, pause, success, fail } from '../actions/actions'
import { AsyncProcess } from './async-operation.model'

export class AsyncOperation {
  private events: Events
  private process: AsyncProcess

  constructor(process: AsyncProcess) {
    this.process = process
    this.events = new Events()
  }

  public readonly start = async (...args: any[]): Promise<void> => {
    this.events.dispatch(start(...args))
    try {
      await this.process()
      this.events.dispatch(success())
    } catch (error) {
      this.events.dispatch(fail(error))
    }
  }

  public readonly cancel = (...args: any[]): void => {
    this.events.dispatch(cancel(...args))
  }

  public readonly pause = (...args: any[]): void => {
    this.events.dispatch(pause(...args))
  }

  public readonly on = (event: Event, handler: (event: Event, current: DerivedState, previous: DerivedState) => void): void => {
    this.events.on(event, handler)
  }
}
