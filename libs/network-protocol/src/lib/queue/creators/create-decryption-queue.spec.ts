import type { UnencryptedPacket } from '../../packet/model'
import { sleep } from '@hyperfrontend/time-utils'
import { logger } from '@hyperfrontend/logging'
import { packetDecryption, unserializedEncryptedPacket } from '../../packet/creators/mocks'
import { isValidUnencryptedPacket } from '../../packet/validations'
import { createDecryptionQueue } from './create-decryption-queue'

describe('createDecryptionQueue', () => {
  const label = 'decryption queue'

  it('successfully decrypts a packet and calls onSuccess', async () => {
    let result: UnencryptedPacket
    const checkResult = () => expect(isValidUnencryptedPacket(result)).toBe(true)
    const onSuccess = (success: UnencryptedPacket) => (result = success)
    const queue = createDecryptionQueue(label, packetDecryption, logger, onSuccess, jest.fn())
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDecryptionQueue(label, packetDecryption, logger, onSuccess, onFail)
    const invalidPacket = <unknown>{ invalid: 'data' }
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when decryption fails', async () => {
    const failingDecryption = jest.fn().mockRejectedValue(new Error('Decryption failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDecryptionQueue(label, failingDecryption, logger, onSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when decrypted packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidDecryption = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDecryptionQueue(label, invalidDecryption, logger, onSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail on unexpected error', async () => {
    const throwingDecryption = () => {
      throw new Error('Unexpected error')
    }
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDecryptionQueue(label, <unknown>throwingDecryption, logger, onSuccess, onFail)
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
    const queue = createDecryptionQueue(label, packetDecryption, logger, throwingOnSuccess, onFail)
    queue.addMessage(unserializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(unserializedEncryptedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createDecryptionQueue('', packetDecryption, logger, jest.fn(), jest.fn())).toThrow()
  })
})
