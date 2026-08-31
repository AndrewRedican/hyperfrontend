import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../packet/model'
import { logger } from '@hyperfrontend/logging'
import { sleep } from '@hyperfrontend/time-utils'
import { packetEncryption, unencryptedPacket } from '../../packet/creators/mocks'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { createEncryptionQueue } from './create-encryption-queue'

describe('createEncryptionQueue', () => {
  const label = 'encryption queue'
  it('successfully encrypts a packet and calls onSuccess', async () => {
    let result: UnserializedEncryptedPacket
    const checkResult = () => expect(isValidUnserializedEncryptedPacket(result)).toBe(true)
    const onSuccess = (success: UnserializedEncryptedPacket) => (result = success)
    const queue = createEncryptionQueue(label, packetEncryption, logger, onSuccess, jest.fn())
    queue.addMessage(unencryptedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createEncryptionQueue(label, packetEncryption, logger, onSuccess, onFail)
    const invalidPacket = { invalid: 'data' } as unknown as UnencryptedPacket
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when encryption fails', async () => {
    const failingEncryption = jest.fn().mockRejectedValue(new Error('Encryption failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createEncryptionQueue(label, failingEncryption, logger, onSuccess, onFail)
    queue.addMessage(unencryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when encrypted packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidEncryption = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createEncryptionQueue(label, invalidEncryption, logger, onSuccess, onFail)
    queue.addMessage(unencryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when onSuccess throws an error', async () => {
    const throwingOnSuccess = () => {
      throw new Error('onSuccess failed')
    }
    const onFail = jest.fn()
    const queue = createEncryptionQueue(label, packetEncryption, logger, throwingOnSuccess, onFail)
    queue.addMessage(unencryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createEncryptionQueue('', packetEncryption, logger, jest.fn(), jest.fn())).toThrow()
  })
})
