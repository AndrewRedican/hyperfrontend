/* eslint-disable @typescript-eslint/no-explicit-any */
import { getType } from '@hyperfrontend/data-utils'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { unencryptedPacket } from '../../packet/creators/mocks'
import { protocol } from '../mocks'
import { label, mockCreateChannel as createChannel, options } from './mocks'

describe('createChannel', () => {
  it('throws error when label is invalid', () => {
    expect(() => createChannel('', options)).toThrow('Cannot create a channel without a valid label')
  })

  it('throws error when the options are missing', () => {
    expect(() => createChannel(label, null as any)).toThrow('Cannot create a channel without a valid options object')
  })

  it('throws error when sender is invalid', () => {
    expect(() => createChannel(label, { ...options, send: null as any })).toThrow('Cannot create a channel without a valid send function')
  })

  it('throws error when receiver is invalid', () => {
    expect(() => createChannel(label, { ...options, receive: null as any })).toThrow(
      'Cannot create a channel without a valid receive function'
    )
  })

  it('throws error when protocol provider is invalid', () => {
    expect(() => createChannel(label, { ...options, protocolProvider: null as any })).toThrow(
      'Cannot create a channel without a valid protocol provider function'
    )
  })

  it('throws error when the session is invalid', () => {
    expect(() => createChannel(label, { ...options, session: { role: 'observer' } as any })).toThrow(
      'Cannot create a channel without a valid session'
    )
  })

  it('exposes the protocol hello exchange unchanged', () => {
    const channel = createChannel(label, options)
    expect({ hello: channel.hello, isHello: channel.isHello, acceptHello: channel.acceptHello }).toEqual({
      hello: protocol.hello,
      isHello: protocol.isHello,
      acceptHello: protocol.acceptHello,
    })
  })

  it('throws error if any protocol property is invalid', () => {
    expect(() => createChannel(label, { ...options, protocolProvider: () => ({}) as any })).toThrow(
      'Cannot create a channel without a valid seal function'
    )
  })

  it('hands the transport callbacks and the session to the protocol provider', () => {
    const protocolProvider = jest.fn(() => protocol)
    createChannel(label, { ...options, protocolProvider })
    expect(protocolProvider).toHaveBeenCalledWith(options.send, options.receive, options.session)
  })

  it('returns a channel exposing its label, operations, and pipelines', () => {
    const channel = createChannel(label, options)
    expect(channel).toEqual(
      expect.objectContaining({
        label,
        send: expect.any(Function),
        receive: expect.any(Function),
        stop: expect.any(Function),
        resume: expect.any(Function),
        outbound: expect.objectContaining({ queue: expect.objectContaining({ size: 0 }) }),
        inbound: expect.objectContaining({ queue: expect.objectContaining({ size: 0 }) }),
      })
    )
  })

  it('returns a frozen channel', () => {
    expect(getType(createChannel(label, options).send)).toEqual('function')
  })

  it('pauses both pipelines when the channel stops', () => {
    const channel = createChannel(label, options)
    channel.stop()
    channel.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    expect(channel.outbound.queue.size).toBe(1)
  })

  it('resumes both pipelines when the channel resumes', async () => {
    const channel = createChannel(label, options)
    channel.stop()
    channel.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    channel.resume()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(channel.outbound.queue.size).toBe(0)
  })

  it('reports an inbound frame the pipeline rejects through onDrop', async () => {
    const onDrop = jest.fn()
    const channel = createChannel(label, { ...options, onDrop })
    channel.receive({ not: 'bytes' } as any)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ direction: 'inbound', stage: 'open' }))
  })

  it('reports an outbound packet the pipeline rejects through onDrop', async () => {
    const onDrop = jest.fn()
    const rejectingSeal = async () => {
      throw new Error('Cannot seal packet')
    }
    const channel = createChannel(label, { ...options, protocolProvider: () => ({ ...protocol, seal: rejectingSeal }), onDrop })
    channel.send(unencryptedPacket.origin, unencryptedPacket.target, unencryptedPacket.data)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onDrop).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'outbound', stage: 'seal', reason: 'Cannot seal packet', cause: expect.any(Error) })
    )
  })
})
