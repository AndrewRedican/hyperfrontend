import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { event } from '../models'
import { AsyncOperation } from './async-operation'

describe('AsyncOperation', () => {
  it('executes the async process when started', async () => {
    const process = jest.fn().mockResolvedValue(undefined)
    const operation = new AsyncOperation(process)

    const startHandler = jest.fn()
    const successHandler = jest.fn()
    const failHandler = jest.fn()

    operation.on(event.InProgress, startHandler)
    operation.on(event.Successful, successHandler)
    operation.on(event.Failed, failHandler)

    await operation.start()

    expect(process).toHaveBeenCalled()
  })

  it('triggers the in-progress and success events but not the fail event when the process resolves', async () => {
    const process = jest.fn().mockResolvedValue(undefined)
    const operation = new AsyncOperation(process)

    const startHandler = jest.fn()
    const successHandler = jest.fn()
    const failHandler = jest.fn()

    operation.on(event.InProgress, startHandler)
    operation.on(event.Successful, successHandler)
    operation.on(event.Failed, failHandler)

    await operation.start()

    expect({
      inProgress: startHandler.mock.calls.length,
      successful: successHandler.mock.calls.length,
      failed: failHandler.mock.calls.length,
    }).toEqual({ inProgress: 1, successful: 1, failed: 0 })
  })

  it('executes a rejecting async process when started', async () => {
    const process = jest.fn().mockRejectedValue(new Error('Process failed'))
    const operation = new AsyncOperation(process)

    const startHandler = jest.fn()
    const successHandler = jest.fn()
    const failHandler = jest.fn()

    operation.on(event.InProgress, startHandler)
    operation.on(event.Successful, successHandler)
    operation.on(event.Failed, failHandler)

    await operation.start()

    expect(process).toHaveBeenCalled()
  })

  it('triggers the in-progress and fail events but not the success event when the process rejects', async () => {
    const process = jest.fn().mockRejectedValue(new Error('Process failed'))
    const operation = new AsyncOperation(process)

    const startHandler = jest.fn()
    const successHandler = jest.fn()
    const failHandler = jest.fn()

    operation.on(event.InProgress, startHandler)
    operation.on(event.Successful, successHandler)
    operation.on(event.Failed, failHandler)

    await operation.start()

    expect({
      inProgress: startHandler.mock.calls.length,
      successful: successHandler.mock.calls.length,
      failed: failHandler.mock.calls.length,
    }).toEqual({ inProgress: 1, successful: 0, failed: 1 })
  })

  it('triggers cancel event when cancel is called', () => {
    const process = jest.fn().mockResolvedValue(undefined)
    const operation = new AsyncOperation(process)

    const cancelHandler = jest.fn()
    operation.on(event.Cancelled, cancelHandler)

    operation.cancel()

    expect(cancelHandler).toHaveBeenCalled()
  })

  it('triggers pause event when pause is called', () => {
    const process = jest.fn().mockResolvedValue(undefined)
    const operation = new AsyncOperation(process)

    const pauseHandler = jest.fn()
    operation.on(event.Paused, pauseHandler)

    operation.pause()

    expect(pauseHandler).toHaveBeenCalled()
  })
})
