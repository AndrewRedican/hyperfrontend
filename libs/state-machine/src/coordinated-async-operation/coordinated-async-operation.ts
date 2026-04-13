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

  public readonly registerProcess = (process: AsyncProcess): CoordinatedAsyncProcess => {
    const asyncOperation = new AsyncOperation(process)
    this.asyncOperations.push(asyncOperation)
    return this
  }

  public readonly startAll = async (): Promise<void[]> => {
    return promiseAll(this.asyncOperations.map((operation) => operation.start()))
  }

  public readonly cancelAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.cancel())
  }

  public readonly pauseAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.pause())
  }
}
