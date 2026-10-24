/* lint-disable typescript/no-explicit-any */
import type { MessageHandler } from '../model'
import { beforeEach } from 'node:test'
import { describe, expect, flushPromises, it, jest } from '@hyperfrontend/testing'
import { createQueue } from './create-queue'

// why: the queue advances on promise settlement alone, so flushPromises, one macrotask hop, runs after every microtask its chain queued and lands on a state nothing changes until the test acts again.

describe('createQueue', () => {
  let processedMessages: any[] = []
  let gates: Array<() => void> = []
  let messageProcessor: MessageHandler<any>
  const rejectOnBoom: MessageHandler<any> = async (message) => {
    if (message.id === 'boom') throw new Error('boom')
    processedMessages.push(message)
  }

  // how: opens the gate of the handler call that has waited longest, so it records its message and settles, then yields so the queue has reacted before the test looks.
  const release = async (): Promise<void> => {
    const open = gates.shift()
    if (!open) throw new Error('no handler call is waiting at a gate')
    open()
    await flushPromises()
  }

  const drain = async (count: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) await release()
  }

  const callCount = (): number => jest.mocked(messageProcessor).mock.calls.length

  beforeEach(() => {
    processedMessages = []
    gates = []
    // why: a handler parked at a gate keeps the queue mid-message for exactly as long as the test needs, where a timed sleep raced the test's own clock on a slow runner.
    messageProcessor = jest.fn(async (message) => {
      await new Promise<void>((open) => {
        gates.push(open)
      })
      processedMessages.push(message)
    })
    jest.clearAllMocks()
  })

  it('processes messages in FIFO order', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    messageHandler.resume()
    const callsOnResume = callCount()

    await drain(2)

    expect({ callsOnResume, callsAfterDrain: callCount(), processedMessages }).toEqual({
      callsOnResume: 1,
      callsAfterDrain: 2,
      processedMessages: [{ id: 1 }, { id: 2 }],
    })
  })

  it('handles multiple messages correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })

    messageHandler.resume()
    const callCounts = [callCount()]

    await release()
    callCounts.push(callCount())

    await release()
    callCounts.push(callCount())

    await release()
    expect({ callCounts, processedMessages }).toEqual({ callCounts: [1, 2, 3], processedMessages: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  })

  it('does not process when queue is empty', async () => {
    createQueue(messageProcessor)

    await flushPromises()

    expect(messageProcessor).not.toHaveBeenCalled()
  })

  it('throws error for invalid processMessage function', () => {
    expect(() => createQueue(null as any)).toThrow('processMessage must be a function')
  })

  it('handles invalid autoStart argument', () => {
    expect(() => createQueue(messageProcessor, null as any)).toThrow('autoStart must be a boolean')
  })

  it.each([null, 'string', 123])('throws error for the invalid message type %p', (message) => {
    const messageHandler = createQueue(messageProcessor, false)

    expect(() => messageHandler.addMessage(message)).toThrow('Message must be a non-null object')
  })

  it('stops and resumes processing correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    messageHandler.stop()
    messageHandler.resume()
    await drain(2)

    expect(messageProcessor).toHaveBeenCalledTimes(2)
  })

  it('returns correct queue size', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    const initial = messageHandler.size()
    messageHandler.addMessage({ id: 1 })
    const afterAdd = messageHandler.size()
    messageHandler.resume()
    await release()
    expect({ initial, afterAdd, afterRelease: messageHandler.size() }).toEqual({ initial: 0, afterAdd: 1, afterRelease: 0 })
  })

  it('returns current message correctly', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })
    messageHandler.addMessage({ id: 2 })

    const beforeResume = messageHandler.currentMessage()

    messageHandler.resume()
    const afterResume = messageHandler.currentMessage()

    await release()
    const afterFirstRelease = messageHandler.currentMessage()

    await release()
    expect({
      beforeResume,
      afterResume,
      afterFirstRelease,
      afterSecondRelease: messageHandler.currentMessage(),
      sizeAfterSecondRelease: messageHandler.size(),
    }).toEqual({
      beforeResume: null,
      afterResume: { id: 1 },
      afterFirstRelease: { id: 2 },
      afterSecondRelease: null,
      sizeAfterSecondRelease: 0,
    })
  })

  it('halts after the in-flight message when stopped with pending messages', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })

    messageHandler.resume()
    messageHandler.stop()

    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })

    // how: the message in flight when stop was called still completes, then the loop halts with the two later ones pending.
    await release()
    expect({
      isRunning: messageHandler.isRunning(),
      currentMessage: messageHandler.currentMessage(),
      size: messageHandler.size(),
      processedMessages,
    }).toEqual({
      isRunning: false,
      currentMessage: null,
      size: 2,
      processedMessages: [{ id: 1 }],
    })
  })

  it('resume starts processing when stopped with pending messages', async () => {
    const messageHandler = createQueue(messageProcessor, false)
    messageHandler.addMessage({ id: 1 })

    messageHandler.resume()
    messageHandler.stop()

    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })

    // how: the message in flight when stop was called still completes, then the loop halts with the two later ones pending.
    await release()

    messageHandler.resume()
    await drain(2)

    expect({ processedCount: processedMessages.length, size: messageHandler.size() }).toEqual({ processedCount: 3, size: 0 })
  })

  it('resume does nothing when queue is empty', () => {
    const messageHandler = createQueue(messageProcessor, false)

    messageHandler.resume()

    expect(messageProcessor).not.toHaveBeenCalled()
  })

  it('resume does nothing when already processing', async () => {
    const messageHandler = createQueue(messageProcessor, true)
    messageHandler.addMessage({ id: 1 })

    messageHandler.resume()
    messageHandler.resume()

    await release()

    expect(messageProcessor).toHaveBeenCalledTimes(1)
  })

  it('handles stop and resume with pending messages', async () => {
    const messageHandler = createQueue(messageProcessor, true)
    messageHandler.addMessage({ id: 1 })

    messageHandler.stop()
    messageHandler.addMessage({ id: 2 })
    messageHandler.addMessage({ id: 3 })
    messageHandler.resume()

    await drain(3)

    expect({ processedCount: processedMessages.length, size: messageHandler.size() }).toEqual({ processedCount: 3, size: 0 })
  })

  it('keeps draining after a handler rejects', async () => {
    const messageHandler = createQueue(rejectOnBoom)
    messageHandler.addMessage({ id: 'a' })
    messageHandler.addMessage({ id: 'boom' })
    messageHandler.addMessage({ id: 'c' })

    await flushPromises()

    expect(processedMessages).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('reports an idle queue once a rejected handler settles', async () => {
    const messageHandler = createQueue(rejectOnBoom)
    messageHandler.addMessage({ id: 'boom' })

    await flushPromises()

    expect({ isRunning: messageHandler.isRunning(), currentMessage: messageHandler.currentMessage(), size: messageHandler.size() }).toEqual(
      {
        isRunning: false,
        currentMessage: null,
        size: 0,
      }
    )
  })

  it('resumes after a handler rejects', async () => {
    const messageHandler = createQueue(rejectOnBoom, false)
    messageHandler.addMessage({ id: 'boom' })
    messageHandler.resume()
    await flushPromises()

    messageHandler.addMessage({ id: 'c' })
    messageHandler.resume()
    await flushPromises()

    expect(processedMessages).toEqual([{ id: 'c' }])
  })
})
