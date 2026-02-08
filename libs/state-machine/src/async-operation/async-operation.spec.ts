import { event } from '../models'
import { AsyncOperation } from './async-operation'

describe('AsyncOperation', () => {
  it('executes the async process and triggers events', async () => {
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
    expect(startHandler).toHaveBeenCalled()
    expect(successHandler).toHaveBeenCalled()
    expect(failHandler).not.toHaveBeenCalled()
  })

  it('triggers fail event on process failure', async () => {
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
    expect(startHandler).toHaveBeenCalled()
    expect(successHandler).not.toHaveBeenCalled()
    expect(failHandler).toHaveBeenCalled()
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
