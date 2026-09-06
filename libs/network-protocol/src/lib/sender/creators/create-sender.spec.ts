import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { packetSealer, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createSender } from './create-sender'
import { createMockLogger, testLabels, testUUIDs } from './test-fixtures'

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('createSender', () => {
  it('returns a frozen sender with its operations and queue', () => {
    const sender = createSender(testLabels.sender1, () => void 0, createMockLogger(), packetSealer)
    expect(sender).toEqual({ send: expect.any(Function), stop: expect.any(Function), resume: expect.any(Function), queue: { size: 0 } })
  })

  it('seals a packet and hands the frame to the transport', async () => {
    const sendPacket = jest.fn()
    const sender = createSender(testLabels.sender1, sendPacket, createMockLogger(), packetSealer)
    sender.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    await settle()
    expect(sendPacket).toHaveBeenCalledWith(wirePacket)
  })

  it('throws in the caller frame for an invalid origin', () => {
    const sender = createSender(testLabels.sender1, () => void 0, createMockLogger(), packetSealer)
    expect(() => sender.send('not-a-uuid', testUUIDs.target1, unencryptedPacket.data)).toThrow(
      'Cannot create a packet without a valid origin value'
    )
  })

  it('holds packets while stopped and reports the queue depth', () => {
    const sender = createSender(testLabels.sender1, () => void 0, createMockLogger(), packetSealer)
    sender.stop()
    sender.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    expect(sender.queue.size).toBe(1)
  })

  it('drains held packets on resume', async () => {
    const sendPacket = jest.fn()
    const sender = createSender(testLabels.sender1, sendPacket, createMockLogger(), packetSealer)
    sender.stop()
    sender.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    sender.resume()
    await settle()
    expect(sendPacket).toHaveBeenCalledTimes(1)
  })

  it('reports a packet the sealer rejects through onDrop', async () => {
    const onDrop = jest.fn()
    const sealer = async () => {
      throw new Error('Cannot seal packet')
    }
    const sender = createSender(testLabels.sender1, () => void 0, createMockLogger(), sealer, onDrop)
    sender.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    await settle()
    expect(onDrop).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'outbound', stage: 'seal', reason: 'Cannot seal packet', cause: expect.any(Error) })
    )
  })

  it('discards a rejected packet silently when no drop handler is given', async () => {
    const sendPacket = jest.fn()
    const sealer = async () => {
      throw new Error('Cannot seal packet')
    }
    const sender = createSender(testLabels.sender1, sendPacket, createMockLogger(), sealer)
    sender.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    await settle()
    expect(sendPacket).not.toHaveBeenCalled()
  })
})
