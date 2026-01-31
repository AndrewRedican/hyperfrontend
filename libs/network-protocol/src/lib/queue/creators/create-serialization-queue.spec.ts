import type { SerializedEncryptedPacket } from '../../packet/model'
import { sleep } from '@hyperfrontend/time-utils'
import { logger } from '@hyperfrontend/logging'
import { packetSerialization, unserializedEncryptedPacket } from '../../packet/creators/mocks'
import { isValidSerializedEncryptedPacket } from '../../packet/validations'
import { createSerializationQueue } from './create-serialization-queue'

describe('createSerializationQueue', () => {
  const label = 'serialization queue'

  it('successfully serializes a packet and calls onSuccess', async () => {
    let result: SerializedEncryptedPacket
    const checkResult = () => expect(isValidSerializedEncryptedPacket(result)).toBe(true)
    const onSuccess = (success: SerializedEncryptedPacket) => (result = success)
    const queue = createSerializationQueue(label, packetSerialization, logger, onSuccess, jest.fn())
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createSerializationQueue(label, packetSerialization, logger, onSuccess, onFail)
    const invalidPacket = <unknown>{ invalid: 'data' }
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when serialization fails', async () => {
    const failingSerialization = jest.fn().mockRejectedValue(new Error('Serialization failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createSerializationQueue(label, failingSerialization, logger, onSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when serialized packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidSerialization = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createSerializationQueue(label, invalidSerialization, logger, onSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when onSuccess throws an error', async () => {
    const throwingOnSuccess = () => {
      throw new Error('onSuccess failed')
    }
    const onFail = jest.fn()
    const queue = createSerializationQueue(label, packetSerialization, logger, throwingOnSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createSerializationQueue('', packetSerialization, logger, jest.fn(), jest.fn())).toThrow()
  })
})
