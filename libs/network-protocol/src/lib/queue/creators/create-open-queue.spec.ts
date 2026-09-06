import type { WirePacket } from '../../packet/model'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { packetOpener, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createOpenQueue } from './create-open-queue'

describe('createOpenQueue', () => {
  const label = 'open queue'

  it('opens a frame and hands the packet to onSuccess', async () => {
    const onSuccess = jest.fn()
    const queue = createOpenQueue(label, packetOpener, logger, onSuccess, jest.fn())
    queue.addMessage(wirePacket)
    await sleep(50)
    expect(onSuccess).toHaveBeenCalledWith(unencryptedPacket)
  })

  it('reports a frame that is not wire bytes', async () => {
    const onFail = jest.fn()
    const queue = createOpenQueue(label, packetOpener, logger, jest.fn(), onFail)
    const invalid = { invalid: 'data' } as unknown as WirePacket
    queue.addMessage(invalid)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(invalid, 'Invalid frame ignored')
  })

  it('reports the error an opener throws', async () => {
    const failure = new Error('replayed')
    const onFail = jest.fn()
    const queue = createOpenQueue(label, jest.fn().mockRejectedValue(failure), logger, jest.fn(), onFail)
    queue.addMessage(wirePacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(wirePacket, 'replayed', failure)
  })

  it('reports an opener result that is not a valid packet', async () => {
    const onFail = jest.fn()
    const queue = createOpenQueue(label, jest.fn().mockResolvedValue({ invalid: 'result' }), logger, jest.fn(), onFail)
    queue.addMessage(wirePacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(wirePacket, 'Opened packet is not valid')
  })

  it('reports an error thrown by onSuccess', async () => {
    const onFail = jest.fn()
    const queue = createOpenQueue(
      label,
      packetOpener,
      logger,
      () => {
        throw new Error('delivery failed')
      },
      onFail
    )
    queue.addMessage(wirePacket)
    await sleep(50)
    expect(onFail).toHaveBeenCalledWith(wirePacket, expect.stringContaining('An unexpected error occurred'), expect.any(Error))
  })

  it('throws when the arguments are invalid', () => {
    expect(() => createOpenQueue('', packetOpener, logger, jest.fn(), jest.fn())).toThrow('Cannot create open queue without a label')
  })
})
