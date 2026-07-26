import type { Logger } from '@hyperfrontend/logging'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityProvider, SecurityProtocolProvider, SecurityReceivePacket, SecurityPacketData } from '../../types/security'
import type { RoutingContext } from './types'
import { attachSecurityTransport } from './attach-security-transport'

describe('attachSecurityTransport', () => {
  let mockLogger: Logger
  let routeAction: jest.Mock
  let context: RoutingContext
  let channel: ChannelHandle
  let attachedTransport: unknown
  let notifyEvent: jest.Mock
  let targetWindow: Window
  let origin: string | null
  let wire: { sent: unknown[]; deliver?: SecurityReceivePacket; failSend: boolean }

  function createFakeProvider(): SecurityProvider {
    return {
      createChannel: (label, sendPacket, receivePacket) => {
        wire.deliver = receivePacket
        return {
          label,
          send: (packetOrigin: string, packetTarget: string, data: SecurityPacketData) => {
            if (wire.failSend) {
              throw new Error('encryption transport failure')
            }
            wire.sent.push({ origin: packetOrigin, target: packetTarget, data })
          },
          receive: jest.fn(),
          stop: jest.fn(),
          resume: jest.fn(),
        }
      },
      protocolProvider: <SecurityProtocolProvider>(<unknown>(() => undefined)),
    }
  }

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    }
    routeAction = jest.fn()
    notifyEvent = jest.fn()
    targetWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    origin = 'https://feature.example.com'
    attachedTransport = null
    wire = { sent: [], failSend: false }

    channel = <ChannelHandle>(<unknown>{
      getName: () => 'test-channel',
      getTarget: () => targetWindow,
      getOrigin: () => origin,
      notifyEvent,
      setSecurityTransport: (transport: unknown) => {
        attachedTransport = transport
      },
    })

    context = <RoutingContext>(<unknown>{
      state: { id: 'broker-1', name: 'test-broker' },
      logger: mockLogger,
      getProtocol: () => createFakeProvider(),
      routeAction,
    })
  })

  it('returns false and attaches nothing when no provider is registered', () => {
    const bare = <RoutingContext>(<unknown>{ ...context, getProtocol: () => undefined })

    const attached = attachSecurityTransport(bare, channel, 'v2', 'peer-1')

    expect({ attached, transport: attachedTransport }).toEqual({ attached: false, transport: null })
  })

  it('attaches a transport for the negotiated protocol', () => {
    const attached = attachSecurityTransport(context, channel, 'v2', 'peer-1')

    expect({ attached, protocol: (<{ getProtocol: () => string }>attachedTransport).getProtocol() }).toEqual({
      attached: true,
      protocol: 'v2',
    })
  })

  it('stamps outbound packets with the broker id and the peer id', () => {
    attachSecurityTransport(context, channel, 'v2', 'peer-1')
    ;(<{ send: (action: unknown) => void }>attachedTransport).send({ type: 'PING' })

    expect(wire.sent).toEqual([expect.objectContaining({ origin: 'broker-1', target: 'peer-1' })])
  })

  it('routes decrypted actions through the broker with the counterpart window as the source', () => {
    attachSecurityTransport(context, channel, 'v2', 'peer-1')

    wire.deliver?.({
      origin: 'peer-1',
      target: 'broker-1',
      data: <SecurityPacketData>(<unknown>{ message: { type: '[nexus] new-message', senderId: 'peer-1', data: { type: 'PING' } } }),
    })

    expect(routeAction).toHaveBeenCalledWith({
      data: { type: '[nexus] new-message', senderId: 'peer-1', data: { type: 'PING' } },
      origin: 'https://feature.example.com',
      source: targetWindow,
    })
  })

  it('synthesizes an empty origin for decrypted actions while the channel is unpinned', () => {
    origin = null
    attachSecurityTransport(context, channel, 'v2', 'peer-1')

    wire.deliver?.({
      origin: 'peer-1',
      target: 'broker-1',
      data: <SecurityPacketData>(<unknown>{ message: { type: '[nexus] new-message', senderId: 'peer-1' } }),
    })

    expect(routeAction).toHaveBeenCalledWith(expect.objectContaining({ origin: '' }))
  })

  it('surfaces transport failures as security-error events', () => {
    wire.failSend = true
    attachSecurityTransport(context, channel, 'v2', 'peer-1')
    ;(<{ send: (action: unknown) => void }>attachedTransport).send({ type: 'PING' })

    expect(notifyEvent).toHaveBeenCalledWith('security-error', expect.objectContaining({ message: 'encryption transport failure' }))
  })

  it('logs transport failures through the broker logger', () => {
    wire.failSend = true
    attachSecurityTransport(context, channel, 'v2', 'peer-1')
    ;(<{ send: (action: unknown) => void }>attachedTransport).send({ type: 'PING' })

    expect(mockLogger.warn).toHaveBeenCalledWith('test-channel security error:', '[transport_error]', 'encryption transport failure')
  })
})
