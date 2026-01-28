import type { UnserializedEncryptedPacket } from '../../packet/model'
import { sleep } from '@hyperfrontend/time-utils'
import { logger } from '@hyperfrontend/logging'
import { packetDeserialization, serializedEncryptedPacket } from '../../packet/creators/mocks'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations'
import { createDeserializationQueue } from './create-deserialization-queue'

describe('createDeserializationQueue', () => {
  const label = 'deserialization queue'

  it('successfully deserializes a packet and calls onSuccess', async () => {
    let result: UnserializedEncryptedPacket
    const checkResult = () => expect(isValidUnserializedEncryptedPacket(result)).toBe(true)
    const onSuccess = (success: UnserializedEncryptedPacket) => (result = success)
    const queue = createDeserializationQueue(label, packetDeserialization, logger, onSuccess, jest.fn())
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeserializationQueue(label, packetDeserialization, logger, onSuccess, onFail)
    const invalidPacket = { invalid: 'data' } as any
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when deserialization fails', async () => {
    const failingDeserialization = jest.fn().mockRejectedValue(new Error('Deserialization failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeserializationQueue(label, failingDeserialization, logger, onSuccess, onFail)
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(serializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when deserialized packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidDeserialization = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeserializationQueue(label, invalidDeserialization, logger, onSuccess, onFail)
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(serializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when onSuccess throws an error', async () => {
    const throwingOnSuccess = () => {
      throw new Error('onSuccess failed')
    }
    const onFail = jest.fn()
    const queue = createDeserializationQueue(label, packetDeserialization, logger, throwingOnSuccess, onFail)
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(serializedEncryptedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createDeserializationQueue('', packetDeserialization, logger, jest.fn(), jest.fn())).toThrow()
  })
})
