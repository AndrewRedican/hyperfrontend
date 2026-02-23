import type { ObfuscatedPacket, SerializedEncryptedPacket } from '../../packet/model'
import { sleep } from '@hyperfrontend/time-utils'
import { logger } from '@hyperfrontend/logging'
import { packetObfuscation, serializedEncryptedPacket } from '../../packet/creators/mocks'
import { isValidObfuscatedPacket } from '../../packet/validations/validations'
import { createObfuscationQueue } from './create-obfuscation-queue'

describe('createObfuscationQueue', () => {
  const label = 'obfuscation queue'

  it('successfully obfuscates a packet and calls onSuccess', async () => {
    let result: ObfuscatedPacket
    const checkResult = () => expect(isValidObfuscatedPacket(result)).toBe(true)
    const onSuccess = (success: ObfuscatedPacket) => (result = success)
    const queue = createObfuscationQueue(label, packetObfuscation, logger, onSuccess, jest.fn())
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createObfuscationQueue(label, packetObfuscation, logger, onSuccess, onFail)
    const invalidPacket = <SerializedEncryptedPacket>(<unknown>{ invalid: 'data' })
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when obfuscation fails', async () => {
    const failingObfuscation = jest.fn().mockRejectedValue(new Error('Obfuscation failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createObfuscationQueue(label, failingObfuscation, logger, onSuccess, onFail)
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(serializedEncryptedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when obfuscated packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidObfuscation = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createObfuscationQueue(label, invalidObfuscation, logger, onSuccess, onFail)
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
    const queue = createObfuscationQueue(label, packetObfuscation, logger, throwingOnSuccess, onFail)
    queue.addMessage(serializedEncryptedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(serializedEncryptedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createObfuscationQueue('', packetObfuscation, logger, jest.fn(), jest.fn())).toThrow()
  })
})
