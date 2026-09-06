import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { packetOpener, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createReceiver } from './create-receiver'
import { createMockLogger, testLabels } from './test-fixtures'

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('createReceiver', () => {
  it('returns a frozen receiver with its operations and queue', () => {
    const receiver = createReceiver(testLabels.receiver1, () => void 0, createMockLogger(), packetOpener)
    expect(receiver).toEqual({
      receive: expect.any(Function),
      stop: expect.any(Function),
      resume: expect.any(Function),
      queue: { size: 0 },
    })
  })

  it('opens a frame and delivers the packet', async () => {
    const receivePacket = jest.fn()
    const receiver = createReceiver(testLabels.receiver1, receivePacket, createMockLogger(), packetOpener)
    receiver.receive(wirePacket)
    await settle()
    expect(receivePacket).toHaveBeenCalledWith(unencryptedPacket)
  })

  it('holds frames while stopped and reports the queue depth', () => {
    const receiver = createReceiver(testLabels.receiver1, () => void 0, createMockLogger(), packetOpener)
    receiver.stop()
    receiver.receive(wirePacket)
    expect(receiver.queue.size).toBe(1)
  })

  it('drains held frames on resume', async () => {
    const receivePacket = jest.fn()
    const receiver = createReceiver(testLabels.receiver1, receivePacket, createMockLogger(), packetOpener)
    receiver.stop()
    receiver.receive(wirePacket)
    receiver.resume()
    await settle()
    expect(receivePacket).toHaveBeenCalledTimes(1)
  })

  it('reports a frame the opener rejects through onDrop', async () => {
    const onDrop = jest.fn()
    const opener = async () => {
      throw new Error('authentication failed')
    }
    const receiver = createReceiver(testLabels.receiver1, () => void 0, createMockLogger(), opener, onDrop)
    receiver.receive(wirePacket)
    await settle()
    expect(onDrop).toHaveBeenCalledWith({
      direction: 'inbound',
      stage: 'open',
      reason: 'authentication failed',
      cause: expect.any(Error),
      packet: wirePacket,
    })
  })

  it('discards a rejected frame silently when no drop handler is given', async () => {
    const receivePacket = jest.fn()
    const opener = async () => {
      throw new Error('authentication failed')
    }
    const receiver = createReceiver(testLabels.receiver1, receivePacket, createMockLogger(), opener)
    receiver.receive(wirePacket)
    await settle()
    expect(receivePacket).not.toHaveBeenCalled()
  })
})
