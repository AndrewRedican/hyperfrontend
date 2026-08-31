import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { CoordinatedAsyncProcess } from './coordinated-async-operation'

describe('CoordinatedAsyncProcess', () => {
  it('executes all registered async processes', async () => {
    const process1 = jest.fn().mockResolvedValue(undefined)
    const process2 = jest.fn().mockResolvedValue(undefined)

    const coordinator = new CoordinatedAsyncProcess().registerProcess(process1).registerProcess(process2)

    await coordinator.startAll()

    expect(process1).toHaveBeenCalled()
    expect(process2).toHaveBeenCalled()
  })

  it('cancels all registered async processes', () => {
    const process1 = jest.fn().mockResolvedValue(undefined)
    const process2 = jest.fn().mockResolvedValue(undefined)

    const coordinator = new CoordinatedAsyncProcess().registerProcess(process1).registerProcess(process2)

    coordinator.cancelAll()
  })

  it('pauses all registered async processes', () => {
    const process1 = jest.fn().mockResolvedValue(undefined)
    const process2 = jest.fn().mockResolvedValue(undefined)

    const coordinator = new CoordinatedAsyncProcess().registerProcess(process1).registerProcess(process2)

    coordinator.pauseAll()
  })
})
