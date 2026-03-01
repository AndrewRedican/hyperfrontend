/* eslint-disable @typescript-eslint/no-explicit-any */
import { getType } from '@hyperfrontend/data-utils'
import { receiver } from '../../receiver/creators/mocks'
import { sender } from '../../sender/creators/mocks'
import { protocolProvider } from '../mocks'
import { mockCreateChannel as createChannel } from './mocks'

describe('createChannel', () => {
  const label = 'label'

  it('throws error when label is invalid', () => {
    expect(() => createChannel('', sender, receiver, protocolProvider)).toThrow('Cannot create a channel without a valid label')
  })

  it('throws error when sender is invalid', () => {
    expect(() => createChannel(label, <any>null, receiver, protocolProvider)).toThrow(
      'Cannot create a channel without a valid send function'
    )
  })

  it('throws error when receiver is invalid', () => {
    expect(() => createChannel(label, sender, <any>null, protocolProvider)).toThrow(
      'Cannot create a channel without a valid receive function'
    )
  })

  it('throws error when protocol provider is invalid', () => {
    expect(() => createChannel(label, sender, receiver, <any>null)).toThrow(
      'Cannot create a channel without a valid protocol provider function'
    )
  })

  it('throws error if any protocol details is invalid', () => {
    expect(() => createChannel(label, sender, receiver, () => <any>{})).toThrow(
      'Cannot create a channel without a valid packetEncryption function'
    )
  })

  it('retuns a new channel', () => {
    const channel = createChannel(label, sender, receiver, protocolProvider)
    expect(channel).toHaveProperty('send')
    expect(getType(channel.send)).toEqual('function')

    expect(channel).toHaveProperty('receive')
    expect(getType(channel.receive)).toEqual('function')

    expect(channel).toHaveProperty('stop')
    expect(getType(channel.stop)).toEqual('function')

    expect(channel).toHaveProperty('resume')
    expect(getType(channel.resume)).toEqual('function')

    expect(channel).toHaveProperty('outbound')
    expect(channel).toHaveProperty('inbound')
  })

  it('calls stop on both inbound and outbound when channel stop is called', () => {
    const channel = createChannel(label, sender, receiver, protocolProvider)
    expect(typeof channel.stop).toBe('function')
    expect(typeof channel.outbound.stop).toBe('function')
    expect(typeof channel.inbound.stop).toBe('function')

    expect(() => channel.stop()).not.toThrow()
  })

  it('calls resume on both inbound and outbound when channel resume is called', () => {
    const channel = createChannel(label, sender, receiver, protocolProvider)
    expect(typeof channel.resume).toBe('function')
    expect(typeof channel.outbound.resume).toBe('function')
    expect(typeof channel.inbound.resume).toBe('function')

    expect(() => channel.resume()).not.toThrow()
  })
})
