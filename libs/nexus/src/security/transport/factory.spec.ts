import type { Mock } from '@hyperfrontend/testing'
import type {
  SecurityChannelOptions,
  SecurityPacket,
  SecurityProvider,
  SecurityTransportConfig,
  SecurityWireChannel,
} from '../../types/security'
import { after as afterAll, afterEach, before as beforeAll } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_REQUEST_RETRY_MS } from '../../constants/defaults'
import { createSecurityTransport } from './factory'

const ORIGIN_ID = 'origin-endpoint'
const TARGET_ID = 'target-endpoint'

interface ProviderHarness {
  provider: SecurityProvider
  createChannel: Mock
  hello: Mock
  captured: { options?: SecurityChannelOptions }
}

function createProviderHarness(): ProviderHarness {
  const hello = jest.fn().mockResolvedValue(new Uint8Array([1]))
  const captured: { options?: SecurityChannelOptions } = {}
  const createChannel = jest.fn((label: string, options: SecurityChannelOptions): SecurityWireChannel => {
    captured.options = options
    return {
      label,
      hello,
      isHello: () => false,
      acceptHello: () => 'accepted',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }
  })
  return { provider: { createChannel, protocolProvider: jest.fn() }, createChannel, hello, captured }
}

function capturedOptions(harness: ProviderHarness): SecurityChannelOptions {
  if (!harness.captured.options) {
    throw createError('The provider did not build a wire channel')
  }
  return harness.captured.options
}

function createConfig(overrides: Partial<SecurityTransportConfig> = {}): SecurityTransportConfig {
  return {
    protocol: 'none',
    label: 'factory-spec',
    target: { postMessage: jest.fn() } as unknown as Window,
    getOrigin: () => null,
    originId: ORIGIN_ID,
    targetId: TARGET_ID,
    role: 'initiator',
    onAction: jest.fn(),
    ...overrides,
  }
}

function createPacket(message: unknown): SecurityPacket {
  return {
    origin: TARGET_ID,
    target: ORIGIN_ID,
    data: { pid: 'peer-process', id: 'packet-1', sequence: 1, message, schema: {}, schemaHash: 'empty' },
  }
}

describe('createSecurityTransport', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('none protocol', () => {
    it('creates a passthrough transport reporting the none protocol', () => {
      const transport = createSecurityTransport(createConfig())

      expect(transport.getProtocol()).toBe('none')
    })

    it('leaves a supplied provider unused', () => {
      const harness = createProviderHarness()

      createSecurityTransport(createConfig({ provider: harness.provider }))

      expect(harness.createChannel).not.toHaveBeenCalled()
    })

    it('posts actions unchanged', () => {
      const postMessage = jest.fn()
      const transport = createSecurityTransport(createConfig({ target: { postMessage } as unknown as Window }))

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })

    it('posts to the pinned origin', () => {
      const postMessage = jest.fn()
      const transport = createSecurityTransport(
        createConfig({ target: { postMessage } as unknown as Window, getOrigin: () => 'https://custom.example.com' })
      )

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, 'https://custom.example.com')
    })
  })

  describe('v3 protocol', () => {
    it('creates a secure transport reporting the v3 protocol', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v3', provider: createProviderHarness().provider }))

      expect(transport.getProtocol()).toBe('v3')
    })

    it('throws when the provider is missing', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'v3' }))).toThrow("Security protocol 'v3' requires a protocol provider")
    })
  })

  describe('v4 protocol', () => {
    it('creates a secure transport reporting the v4 protocol', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v4', provider: createProviderHarness().provider }))

      expect(transport.getProtocol()).toBe('v4')
    })

    it('throws when the provider is missing', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'v4' }))).toThrow("Security protocol 'v4' requires a protocol provider")
    })
  })

  describe('external protocols', () => {
    it('creates a secure transport for a custom protocol identifier', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'acme-x25519', provider: createProviderHarness().provider }))

      expect(transport.getProtocol()).toBe('acme-x25519')
    })

    it('throws when a custom protocol has no provider', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'acme-x25519' }))).toThrow(
        "Security protocol 'acme-x25519' requires a protocol provider"
      )
    })
  })

  describe('secure transport wiring', () => {
    it('labels the wire channel', () => {
      const harness = createProviderHarness()

      createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider }))

      expect(harness.createChannel).toHaveBeenCalledWith('factory-spec', expect.any(Object))
    })

    it('describes the session from the endpoint ids and role', () => {
      const harness = createProviderHarness()

      createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider, role: 'responder' }))

      expect(capturedOptions(harness).session).toEqual({ protocol: 'v4', role: 'responder', localId: ORIGIN_ID, peerId: TARGET_ID })
    })

    it("hands the provider's protocol factory to the wire channel", () => {
      const harness = createProviderHarness()

      createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider }))

      expect(capturedOptions(harness).protocolProvider).toBe(harness.provider.protocolProvider)
    })

    it('delivers opened actions through onAction', () => {
      const harness = createProviderHarness()
      const onAction = jest.fn()

      createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider, onAction }))
      capturedOptions(harness).receive(createPacket({ type: 'PING' }))

      expect(onAction).toHaveBeenCalledWith({ type: 'PING' })
    })

    it('announces the confirmed session through onConfirmed', () => {
      const harness = createProviderHarness()
      const onConfirmed = jest.fn()

      createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider, onConfirmed }))
      capturedOptions(harness).receive(createPacket({ type: 'PING' }))

      expect(onConfirmed).toHaveBeenCalledTimes(1)
    })

    it('reports failures through onError', () => {
      const onError = jest.fn()
      const transport = createSecurityTransport(
        createConfig({ protocol: 'v4', provider: createProviderHarness().provider, confirmTimeoutMs: 50, onError })
      )

      transport.start()
      jest.advanceTimersByTime(50)

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'security-unconfirmed' }))
    })

    it('fails the session through onFailed', () => {
      const onFailed = jest.fn()
      const transport = createSecurityTransport(
        createConfig({ protocol: 'v4', provider: createProviderHarness().provider, confirmTimeoutMs: 50, onFailed })
      )

      transport.start()
      jest.advanceTimersByTime(50)

      expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ code: 'security-unconfirmed' }))
    })
  })

  describe('timing defaults', () => {
    it('retries the hello at the request retry interval by default', () => {
      const harness = createProviderHarness()
      const transport = createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider }))

      transport.start()
      jest.advanceTimersByTime(DEFAULT_REQUEST_RETRY_MS * 2)

      expect(harness.hello).toHaveBeenCalledTimes(3)
    })

    it('keeps the session pending inside the connect timeout by default', () => {
      const onFailed = jest.fn()
      const transport = createSecurityTransport(createConfig({ protocol: 'v4', provider: createProviderHarness().provider, onFailed }))

      transport.start()
      jest.advanceTimersByTime(DEFAULT_CONNECT_TIMEOUT_MS - 1)

      expect(onFailed).not.toHaveBeenCalled()
    })

    it('arms the connect timeout as the confirmation deadline by default', () => {
      const onFailed = jest.fn()
      const transport = createSecurityTransport(createConfig({ protocol: 'v4', provider: createProviderHarness().provider, onFailed }))

      transport.start()
      jest.advanceTimersByTime(DEFAULT_CONNECT_TIMEOUT_MS)

      expect(onFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'security-unconfirmed',
          message: expect.stringContaining(`within ${DEFAULT_CONNECT_TIMEOUT_MS}ms`),
        })
      )
    })

    it('honours an explicit hello retry interval', () => {
      const harness = createProviderHarness()
      const transport = createSecurityTransport(createConfig({ protocol: 'v4', provider: harness.provider, helloRetryMs: 40 }))

      transport.start()
      jest.advanceTimersByTime(80)

      expect(harness.hello).toHaveBeenCalledTimes(3)
    })

    it('honours an explicit confirmation deadline', () => {
      const onFailed = jest.fn()
      const transport = createSecurityTransport(
        createConfig({ protocol: 'v4', provider: createProviderHarness().provider, confirmTimeoutMs: 60, onFailed })
      )

      transport.start()
      jest.advanceTimersByTime(60)

      expect(onFailed).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'security-unconfirmed', message: expect.stringContaining('within 60ms') })
      )
    })
  })
})
