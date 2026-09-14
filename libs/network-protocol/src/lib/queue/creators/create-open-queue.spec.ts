import type { WirePacket } from '../../packet/model'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { packetOpener, unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { createOpenQueue } from './create-open-queue'

describe('createOpenQueue', () => {
  const label = 'open queue'
  const invalid = { invalid: 'data' } as unknown as WirePacket
  const throwingOnFail = () => {
    throw new Error('consumer bug')
  }

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

  it('keeps draining after onFail throws', async () => {
    const onSuccess = jest.fn()
    const queue = createOpenQueue(label, packetOpener, logger, onSuccess, throwingOnFail)
    queue.addMessage(invalid)
    queue.addMessage(wirePacket)
    await sleep(50)
    expect(onSuccess).toHaveBeenCalledWith(unencryptedPacket)
  })

  it('reports a rejected frame to a throwing onFail once', async () => {
    const onFail = jest.fn(throwingOnFail)
    const queue = createOpenQueue(label, packetOpener, logger, jest.fn(), onFail)
    queue.addMessage(invalid)
    await sleep(50)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('logs the error a throwing onFail raises', async () => {
    const error = jest.fn()
    const queue = createOpenQueue(label, packetOpener, { ...logger, error }, jest.fn(), throwingOnFail)
    queue.addMessage(invalid)
    await sleep(50)
    expect(error).toHaveBeenCalledWith(`${label}: onFail threw. Error: consumer bug`)
  })

  it('throws when the arguments are invalid', () => {
    expect(() => createOpenQueue('', packetOpener, logger, jest.fn(), jest.fn())).toThrow('Cannot create open queue without a label')
  })
})
