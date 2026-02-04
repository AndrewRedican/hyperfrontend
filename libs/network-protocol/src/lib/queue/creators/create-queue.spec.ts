/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessageHandler } from '../model'
import { createQueue } from './create-queue'
import { sleep } from '@hyperfrontend/time-utils'

describe('createQueue', () => {
  let processedMessages: any[] = []
  let messageProcessor: MessageHandler<any>

  beforeEach(() => {
    processedMessages = []
    messageProcessor = jest.fn(async (message) => {
      await sleep(50)
      processedMessages.push(message)
    })
    jest.clearAllMocks()
  })

  it('processes messages in FIFO order', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    messageHandler.resume()
    await sleep(2 * 50 + 10)

    expect(messageProcessor).toHaveBeenCalledTimes(2)
    expect(processedMessages[0]).toEqual({ id: 1 })
    expect(processedMessages[1]).toEqual({ id: 2 })
  })

  it('handles multiple messages correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })

    messageHandler.resume()
    await sleep(3 * 50 + 20)

    expect(messageProcessor).toHaveBeenCalledTimes(3)
    expect(processedMessages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('does not process when queue is empty', async () => {
    createQueue(messageProcessor)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(messageProcessor).not.toHaveBeenCalled()
  })

  it('throws error for invalid processMessage function', () => {
    expect(() => createQueue(<any>null)).toThrow('processMessage must be a function')
  })

  it('handles invalid autoStart argument', () => {
    expect(() => createQueue(messageProcessor, <any>null)).toThrow('autoStart must be a boolean')
  })

  it('throws error for invalid message type', () => {
    const messageHandler = createQueue(messageProcessor, false)

    expect(() => messageHandler.addMessage(<any>null)).toThrow('Message must be a non-null object')
    expect(() => messageHandler.addMessage(<any>'string')).toThrow('Message must be a non-null object')
    expect(() => messageHandler.addMessage(<any>123)).toThrow('Message must be a non-null object')
  })

  it('stops and resumes processing correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    messageHandler.stop()
    messageHandler.resume()
    await sleep(2 * 50)

    expect(messageProcessor).toHaveBeenCalledTimes(2)
  })

  it('returns correct queue size', () => {
    const messageHandler = createQueue(messageProcessor, false)
    expect(messageHandler.size()).toEqual(0)
    messageHandler.addMessage({ id: 1 })
    expect(messageHandler.size()).toEqual(1)
    messageHandler.resume()
  })

  it('returns current message correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    expect(messageHandler.currentMessage()).toBeNull()

    messageHandler.resume()
    await sleep(10)
    expect(messageHandler.currentMessage()).toEqual({ id: 1 })

    await sleep(100)
    expect(messageHandler.currentMessage()).toBeNull()
    expect(messageHandler.size()).toEqual(0)
  })

  it('resume starts processing when stopped with pending messages', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })

    messageHandler.resume()
    await sleep(10)

    messageHandler.stop()

    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })

    expect(messageHandler.size()).toBeGreaterThan(0)

    messageHandler.resume()
    await sleep(3 * 50 + 20)

    expect(processedMessages.length).toBe(3)
    expect(messageHandler.size()).toBe(0)
  })

  it('resume does nothing when queue is empty', () => {
    const messageHandler = createQueue(messageProcessor, false)

    expect(() => messageHandler.resume()).not.toThrow()
    expect(messageProcessor).not.toHaveBeenCalled()
  })

  it('resume does nothing when already processing', async () => {
    const messageHandler = createQueue(messageProcessor, true)
    messageHandler.addMessage({ id: 1 })

    messageHandler.resume()
    messageHandler.resume()

    await sleep(50 + 10)

    expect(messageProcessor).toHaveBeenCalledTimes(1)
  })

  it('handles stop and resume with pending messages', async () => {
    const messageHandler = createQueue(messageProcessor, true)
    messageHandler.addMessage({ id: 1 })

    await sleep(10)

    messageHandler.stop()
    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })
    messageHandler.resume()

    await sleep(3 * 50 + 50)

    expect(processedMessages.length).toBe(3)
    expect(messageHandler.size()).toBe(0)
  })
})
