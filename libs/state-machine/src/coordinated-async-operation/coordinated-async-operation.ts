import type { AsyncProcess } from '../async-operation/async-operation.model'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { AsyncOperation } from '../async-operation/async-operation'

/**
 * Coordinates multiple async operations, allowing them to be started, cancelled, or paused together.
 *
 * @example Coordinating multiple async operations
 * ```typescript
 * const coordinator = new CoordinatedAsyncProcess()
 *   .registerProcess(fetchUsers)
 *   .registerProcess(fetchOrders)
 * await coordinator.startAll()
 * ```
 */
export class CoordinatedAsyncProcess {
  private asyncOperations: AsyncOperation[] = []

  /**
   * Adds a process to the group, wrapped in an `AsyncOperation` of its own.
   *
   * Registration does not run the process; `startAll` does. Processes keep the order they
   * were registered in.
   *
   * @param process - The asynchronous work to add
   * @returns This coordinator, so registrations can be chained
   */
  public readonly registerProcess = (process: AsyncProcess): CoordinatedAsyncProcess => {
    const asyncOperation = new AsyncOperation(process)
    this.asyncOperations.push(asyncOperation)
    return this
  }

  /**
   * Starts every registered process at once.
   *
   * Each process runs through its own operation, which catches its rejection and records it
   * as that operation's failure, so one process failing neither stops the others nor rejects
   * the returned promise.
   *
   * @returns Resolves once every process has settled, with one entry per operation and no values
   */
  public readonly startAll = async (): Promise<void[]> => {
    return promiseAll(this.asyncOperations.map((operation) => operation.start()))
  }

  /**
   * Cancels every registered operation, in registration order.
   *
   * Each cancellation only changes that operation's state; the processes themselves keep
   * running to completion.
   */
  public readonly cancelAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.cancel())
  }

  /**
   * Pauses every registered operation, in registration order.
   *
   * Each pause only changes that operation's state; the processes themselves are not suspended.
   */
  public readonly pauseAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.pause())
  }
}
