import type { UnencryptedPacket } from '../../packet/model'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { packetSealer, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createSealQueue } from './create-seal-queue'

describe('createSealQueue', () => {
  const label = 'seal queue'
  const invalid = { invalid: 'data' } as unknown as UnencryptedPacket
  const throwingOnFail = () => {
    throw new Error('consumer bug')
  }

  it('seals a packet and hands the wire bytes to onSuccess', async () => {
    const onSuccess = jest.fn()
    const queue = createSealQueue(label, packetSealer, logger, onSuccess, jest.fn())
    queue.addMessage(unencryptedPacket)
    await sleep(50)
    expect(onSuccess).toHaveBeenCalledWith(wirePacket)
  })

  it('reports a packet that is not a valid plaintext packet', async () => {
    const onFail = jest.fn()
    const queue = createSealQueue(label, packetSealer, logger, jest.fn(), onFail)
    queue.addMessage(invalid)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(invalid, 'Invalid packet ignored')
  })

  it('reports the error a sealer throws', async () => {
    const failure = new Error('Cannot seal past the counter limit')
    const onFail = jest.fn()
    const queue = createSealQueue(label, jest.fn().mockRejectedValue(failure), logger, jest.fn(), onFail)
    queue.addMessage(unencryptedPacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket, 'Cannot seal past the counter limit', failure)
  })

  it('reports a sealer result that is not wire bytes', async () => {
    const onFail = jest.fn()
    const queue = createSealQueue(label, jest.fn().mockResolvedValue('bytes'), logger, jest.fn(), onFail)
    queue.addMessage(unencryptedPacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket, 'Sealed packet is not valid')
  })

  it('reports an error thrown by onSuccess', async () => {
    const onFail = jest.fn()
    const queue = createSealQueue(
      label,
      packetSealer,
      logger,
      () => {
        throw new Error('delivery failed')
      },
      onFail
    )
    queue.addMessage(unencryptedPacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(unencryptedPacket, expect.stringContaining('An unexpected error occurred'), expect.any(Error))
  })

  it('keeps draining after onFail throws', async () => {
    const onSuccess = jest.fn()
    const queue = createSealQueue(label, packetSealer, logger, onSuccess, throwingOnFail)
    queue.addMessage(invalid)
    queue.addMessage(unencryptedPacket)
    await sleep(50)
    expect(onSuccess).toHaveBeenCalledWith(wirePacket)
  })

  it('reports a rejected packet to a throwing onFail once', async () => {
    const onFail = jest.fn(throwingOnFail)
    const queue = createSealQueue(label, packetSealer, logger, jest.fn(), onFail)
    queue.addMessage(invalid)
    await sleep(50)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('logs the error a throwing onFail raises', async () => {
    const error = jest.fn()
    const queue = createSealQueue(label, packetSealer, { ...logger, error }, jest.fn(), throwingOnFail)
    queue.addMessage(invalid)
    await sleep(50)
    expect(error).toHaveBeenCalledWith(`${label}: onFail threw. Error: consumer bug`)
  })

  it('throws when the arguments are invalid', () => {
    expect(() => createSealQueue('', packetSealer, logger, jest.fn(), jest.fn())).toThrow('Cannot create seal queue without a label')
  })
})
