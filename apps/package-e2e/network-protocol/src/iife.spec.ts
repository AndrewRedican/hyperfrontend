/**
 * IIFE bundle E2E tests for `@hyperfrontend/network-protocol`
 * Tests that the browser bundles load correctly, attach to window, and run the
 * session envelope end to end from the global: hello exchange, seal, open,
 * replay rejection, and a v4 key mismatch.
 *
 * Note: network-protocol has two browser bundles with separate global names:
 * - HyperfrontendNetworkProtocolV3 (v3 protocol, keyed from the hello exchange alone)
 * - HyperfrontendNetworkProtocolV4 (v4 protocol, keyed with a pre-shared key mixed in)
 */

import { describe, expect, it } from '@hyperfrontend/testing'

import { loadBundleCode, executeBundleInWindow } from '../../shared/helpers'
import { resolve, join } from 'node:path'

/** The protocols the package ships a bundle for. */
type BundleVersion = 'v3' | 'v4'

// note: network-protocol ships one bundle per protocol under bundle/v3 and bundle/v4, so the shared getBundlePath does not apply.
const getBundlePath = (version: BundleVersion, format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(process.cwd(), 'dist/libs/network-protocol')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', version, `index.${format}${ext}`)
}

/** The negotiated session a provider binds a protocol instance to. */
interface Session {
  /** The negotiated protocol id. */
  readonly protocol: string
  /** Which side of the handshake this endpoint played. */
  readonly role: 'initiator' | 'responder'
  /** This endpoint's identity. */
  readonly localId: string
  /** The peer's identity. */
  readonly peerId: string
}

/** A plaintext packet as the bundle seals and opens it. */
interface Packet {
  /** The sender's identity. */
  readonly origin: string
  /** The recipient's identity. */
  readonly target: string
  /** The data envelope. */
  readonly data: object
}

/** Slice of a protocol instance used by these tests. */
interface Protocol {
  /** This side's plaintext hello frame. */
  hello(): Promise<Uint8Array>
  /** Tells a hello frame apart from a sealed frame. */
  isHello(frame: Uint8Array): boolean
  /** Feeds the peer's hello frame. */
  acceptHello(frame: Uint8Array): 'accepted' | 'duplicate' | 'rejected'
  /** Seals a packet under the session's sending key. */
  seal(packet: Packet): Promise<Uint8Array>
  /** Opens a frame under the session's receiving key. */
  open(frame: Uint8Array): Promise<Packet>
}

/** Binds a protocol instance to a session. */
type ProtocolProvider = (send: (frame: Uint8Array) => void, receive: (packet: Packet) => void, session: Session) => Protocol

/** The logger shape `createProtocol` validates before it builds a provider. */
interface Logger {
  /** Standard log output. */
  log(...data: unknown[]): void
  /** Warning-level output. */
  warn(...data: unknown[]): void
  /** Error-level output. */
  error(...data: unknown[]): void
  /** Info-level output. */
  info(...data: unknown[]): void
  /** Debug-level output. */
  debug(...data: unknown[]): void
  /** Sets the current log level. */
  setLogLevel(level: string): void
  /** Gets the current log level. */
  getLogLevel(): string
  /** Returns a sub-logger. */
  channel(prefix: string): Logger
  /** Wraps a sync call with timing. */
  timed<T>(label: string, fn: () => T): T
  /** Wraps a promise-returning call with timing. */
  timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T>
}

/** Slice of a protocol bundle's global used by these tests. */
interface ProtocolGlobal {
  /** Builds the provider a channel binds to a session; v4 takes the shared key as well. */
  createProtocol(logger: Logger, sharedKey?: string): ProtocolProvider
}

/** Slice of the v3 bundle's global beyond `createProtocol`. */
interface V3Global extends ProtocolGlobal {
  /** The v3 id and frame version byte. */
  V3: { id: string; version: number }
}

/** Slice of the v4 bundle's global beyond `createProtocol`. */
interface V4Global extends ProtocolGlobal {
  /** The shortest shared key v4 accepts. */
  MIN_SHARED_KEY_LENGTH: number
  /** Checks that a value can serve as a v4 shared key. */
  isValidSharedKey(value: unknown): boolean
  /** The v4 id and frame version byte. */
  V4: { id: string; version: number }
}

const INITIATOR_ID = '550e8400-e29b-41d4-a716-446655440000'
const RESPONDER_ID = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
const SHARED_KEY = 'e2e-shared-key-0123456789abcdef'
const OTHER_KEY = 'e2e-other-key-fedcba9876543210'

// note: The bundles carry only the protocol entry, so the packet is built by hand in the shape the data and packet factories produce.
const PACKET: Packet = {
  origin: INITIATOR_ID,
  target: RESPONDER_ID,
  data: {
    pid: INITIATOR_ID,
    id: '9f8e7d6c-5b4a-4321-8765-4321fedcba98',
    sequence: 1,
    message: { type: 'PING', note: 'E2E-PLAINTEXT' },
    schema: { type: 'object', properties: { type: { type: 'string' }, note: { type: 'string' } } },
    schemaHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
}

const noop = () => void 0

const silentLogger: Logger = {
  log: noop,
  warn: noop,
  error: noop,
  info: noop,
  debug: noop,
  setLogLevel: noop,
  getLogLevel: () => 'info',
  channel: () => silentLogger,
  timed: (_label, fn) => fn(),
  timedAsync: (_label, fn) => fn(),
}

const bundles = [
  ['v3', 'HyperfrontendNetworkProtocolV3', 3, (api: ProtocolGlobal) => api.createProtocol(silentLogger)],
  ['v4', 'HyperfrontendNetworkProtocolV4', 4, (api: ProtocolGlobal) => api.createProtocol(silentLogger, SHARED_KEY)],
] as const

/**
 * Evaluates a bundle against the window and returns the global it attached.
 *
 * @param version - The protocol whose bundle to load.
 * @param globalName - The global the bundle attaches.
 * @returns The bundle's API.
 */
function loadGlobal(version: BundleVersion, globalName: string): ProtocolGlobal {
  return executeBundleInWindow(loadBundleCode(getBundlePath(version, 'iife')), globalName) as ProtocolGlobal
}

/**
 * Builds the two mirrored sessions of one negotiated protocol.
 *
 * @param protocol - The negotiated protocol id both sides carry.
 * @returns The initiator's and the responder's session.
 */
function sessions(protocol: string): { initiator: Session; responder: Session } {
  return {
    initiator: { protocol, role: 'initiator', localId: INITIATOR_ID, peerId: RESPONDER_ID },
    responder: { protocol, role: 'responder', localId: RESPONDER_ID, peerId: INITIATOR_ID },
  }
}

/**
 * Binds one protocol instance per side to the mirrored sessions and exchanges their hellos.
 *
 * @param protocol - The negotiated protocol id.
 * @param initiatorProvider - The provider building the initiating side.
 * @param responderProvider - The provider building the answering side.
 * @returns Both instances, ready to seal and open.
 */
async function link(
  protocol: string,
  initiatorProvider: ProtocolProvider,
  responderProvider: ProtocolProvider
): Promise<{ initiator: Protocol; responder: Protocol }> {
  const pair = sessions(protocol)
  const initiator = initiatorProvider(noop, noop, pair.initiator)
  const responder = responderProvider(noop, noop, pair.responder)
  responder.acceptHello(await initiator.hello())
  initiator.acceptHello(await responder.hello())
  return { initiator, responder }
}

/**
 * Runs a protocol operation and reads the protocol error code off what it throws or rejects with.
 *
 * @param operation - The operation being exercised.
 * @returns The error code, or undefined when the operation succeeded.
 */
async function rejectionCode(operation: () => unknown): Promise<string | undefined> {
  try {
    await operation()
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

describe('@hyperfrontend/network-protocol IIFE bundle', () => {
  it.each(bundles)('%s bundle file exists', (version: BundleVersion) => {
    expect(() => loadBundleCode(getBundlePath(version, 'iife'))).not.toThrow()
  })

  it.each(bundles)('%s minified bundle file exists', (version: BundleVersion) => {
    expect(() => loadBundleCode(getBundlePath(version, 'iife', true))).not.toThrow()
  })

  it.each(bundles)('%s bundle attaches %s to window global', (version: BundleVersion, globalName: string) => {
    expect(executeBundleInWindow(loadBundleCode(getBundlePath(version, 'iife')), globalName)).toBeDefined()
  })

  it.each(bundles)('%s bundle exports createProtocol function on the global', (version: BundleVersion, globalName: string) => {
    expect(typeof loadGlobal(version, globalName).createProtocol).toBe('function')
  })

  it.each(bundles)(
    '%s bundle emits a 99-byte plaintext hello carrying its version byte',
    async (version: BundleVersion, globalName: string, versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const hello = await build(loadGlobal(version, globalName))(noop, noop, sessions(version).initiator).hello()
      expect({ length: hello.length, header: [...hello.subarray(0, 2)] }).toEqual({ length: 99, header: [versionByte, 1] })
    }
  )

  it.each(bundles)(
    '%s bundle accepts the peer hello once and reports its retry as a duplicate',
    async (version: BundleVersion, globalName: string, _versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const provider = build(loadGlobal(version, globalName))
      const pair = sessions(version)
      const initiator = provider(noop, noop, pair.initiator)
      const responderHello = await provider(noop, noop, pair.responder).hello()
      expect([initiator.acceptHello(responderHello), initiator.acceptHello(responderHello)]).toEqual(['accepted', 'duplicate'])
    }
  )

  it.each(bundles)(
    '%s bundle rejects a hello from a third instance once the session is keyed',
    async (version: BundleVersion, globalName: string, _versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const provider = build(loadGlobal(version, globalName))
      const pair = sessions(version)
      const initiator = provider(noop, noop, pair.initiator)
      initiator.acceptHello(await provider(noop, noop, pair.responder).hello())
      expect(initiator.acceptHello(await provider(noop, noop, pair.responder).hello())).toBe('rejected')
    }
  )

  it.each(bundles)(
    '%s bundle opens on the responder the packet the initiator sealed',
    async (version: BundleVersion, globalName: string, _versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const provider = build(loadGlobal(version, globalName))
      const { initiator, responder } = await link(version, provider, provider)
      expect(await responder.open(await initiator.seal(PACKET))).toEqual(PACKET)
    }
  )

  it.each(bundles)(
    '%s bundle keeps the message out of the sealed frame',
    async (version: BundleVersion, globalName: string, _versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const provider = build(loadGlobal(version, globalName))
      const { initiator } = await link(version, provider, provider)
      expect(new TextDecoder().decode(await initiator.seal(PACKET))).not.toContain('E2E-PLAINTEXT')
    }
  )

  it.each(bundles)(
    '%s bundle rejects a replayed frame with the replayed code',
    async (version: BundleVersion, globalName: string, _versionByte: number, build: (api: ProtocolGlobal) => ProtocolProvider) => {
      const provider = build(loadGlobal(version, globalName))
      const { initiator, responder } = await link(version, provider, provider)
      const frame = await initiator.seal(PACKET)
      await responder.open(frame)
      expect(await rejectionCode(() => responder.open(frame))).toBe('replayed')
    }
  )

  describe('V3 bundle', () => {
    it('exports the V3 definition on the global', () => {
      expect((loadGlobal('v3', 'HyperfrontendNetworkProtocolV3') as V3Global).V3).toEqual({ id: 'v3', version: 3 })
    })

    it('refuses a session negotiated for another protocol with invalid-session', async () => {
      const provider = loadGlobal('v3', 'HyperfrontendNetworkProtocolV3').createProtocol(silentLogger)
      expect(await rejectionCode(() => provider(noop, noop, sessions('v4').initiator))).toBe('invalid-session')
    })
  })

  describe('V4 bundle', () => {
    it('exports the V4 definition on the global', () => {
      expect((loadGlobal('v4', 'HyperfrontendNetworkProtocolV4') as V4Global).V4).toEqual({ id: 'v4', version: 4 })
    })

    it('exports a 16-character minimum shared key length on the global', () => {
      expect((loadGlobal('v4', 'HyperfrontendNetworkProtocolV4') as V4Global).MIN_SHARED_KEY_LENGTH).toBe(16)
    })

    it('validates a shared key against the minimum length', () => {
      const { isValidSharedKey } = loadGlobal('v4', 'HyperfrontendNetworkProtocolV4') as V4Global
      expect([isValidSharedKey('0123456789abcdef'), isValidSharedKey('0123456789abcde')]).toEqual([true, false])
    })

    it('throws when the shared key is shorter than 16 characters', () => {
      const { createProtocol } = loadGlobal('v4', 'HyperfrontendNetworkProtocolV4')
      expect(() => createProtocol(silentLogger, 'short-key')).toThrow()
    })

    it('rejects every frame from a side holding a different key with authentication-failed', async () => {
      const { createProtocol } = loadGlobal('v4', 'HyperfrontendNetworkProtocolV4')
      const { initiator, responder } = await link('v4', createProtocol(silentLogger, OTHER_KEY), createProtocol(silentLogger, SHARED_KEY))
      const frame = await initiator.seal(PACKET)
      expect(await rejectionCode(() => responder.open(frame))).toBe('authentication-failed')
    })
  })
})
