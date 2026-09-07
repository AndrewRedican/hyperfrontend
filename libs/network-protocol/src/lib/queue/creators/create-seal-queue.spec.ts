import type { UnencryptedPacket } from '../../packet/model'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { packetSealer, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createSealQueue } from './create-seal-queue'

describe('createSealQueue', () => {
  const label = 'seal queue'

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
    const invalid = { invalid: 'data' } as unknown as UnencryptedPacket
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

  it('throws when the arguments are invalid', () => {
    expect(() => createSealQueue('', packetSealer, logger, jest.fn(), jest.fn())).toThrow('Cannot create seal queue without a label')
  })
})
