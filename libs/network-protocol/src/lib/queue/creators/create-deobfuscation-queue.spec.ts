import type { SerializedEncryptedPacket } from '../../packet/model'
import { sleep } from '@hyperfrontend/time-utils'
import { logger } from '@hyperfrontend/logging'
import { packetDeobfuscation, obfuscatedPacket } from '../../packet/creators/mocks'
import { isValidSerializedEncryptedPacket } from '../../packet/validations'
import { createDeobfuscationQueue } from './create-deobfuscation-queue'

describe('createDeobfuscationQueue', () => {
  const label = 'deobfuscation queue'

  it('successfully deobfuscates a packet and calls onSuccess', async () => {
    let result: SerializedEncryptedPacket
    const checkResult = () => expect(isValidSerializedEncryptedPacket(result)).toBe(true)
    const onSuccess = (success: SerializedEncryptedPacket) => (result = success)
    const queue = createDeobfuscationQueue(label, packetDeobfuscation, logger, onSuccess, jest.fn())
    queue.addMessage(obfuscatedPacket)
    await sleep(100)
    checkResult()
  })

  it('calls onFail when packet is invalid', async () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeobfuscationQueue(label, packetDeobfuscation, logger, onSuccess, onFail)
    const invalidPacket = <unknown>{ invalid: 'data' }
    queue.addMessage(invalidPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(invalidPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when deobfuscation fails', async () => {
    const failingDeobfuscation = jest.fn().mockRejectedValue(new Error('Deobfuscation failed'))
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeobfuscationQueue(label, failingDeobfuscation, logger, onSuccess, onFail)
    queue.addMessage(obfuscatedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(obfuscatedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when deobfuscated packet is invalid', async () => {
    const invalidResult = { invalid: 'result' }
    const invalidDeobfuscation = jest.fn().mockResolvedValue(invalidResult)
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    const queue = createDeobfuscationQueue(label, invalidDeobfuscation, logger, onSuccess, onFail)
    queue.addMessage(obfuscatedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(obfuscatedPacket)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onFail when onSuccess throws an error', async () => {
    const throwingOnSuccess = () => {
      throw new Error('onSuccess failed')
    }
    const onFail = jest.fn()
    const queue = createDeobfuscationQueue(label, packetDeobfuscation, logger, throwingOnSuccess, onFail)
    queue.addMessage(obfuscatedPacket)
    await sleep(100)
    expect(onFail).toHaveBeenCalledWith(obfuscatedPacket)
  })

  it('throws error when validation fails', () => {
    expect(() => createDeobfuscationQueue('', packetDeobfuscation, logger, jest.fn(), jest.fn())).toThrow()
  })
})
