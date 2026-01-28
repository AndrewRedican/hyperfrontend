import type { AsyncProcess } from '../async-operation/async-operation.model'
import { AsyncOperation } from '../async-operation/async-operation'

export class CoordinatedAsyncProcess {
  private asyncOperations: AsyncOperation[] = []

  public readonly registerProcess = (process: AsyncProcess): CoordinatedAsyncProcess => {
    const asyncOperation = new AsyncOperation(process)
    this.asyncOperations.push(asyncOperation)
    return this
  }

  public readonly startAll = async (): Promise<void[]> => {
    return Promise.all(this.asyncOperations.map((operation) => operation.start()))
  }

  public readonly cancelAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.cancel())
  }

  public readonly pauseAll = (): void => {
    this.asyncOperations.forEach((operation) => operation.pause())
  }
}
