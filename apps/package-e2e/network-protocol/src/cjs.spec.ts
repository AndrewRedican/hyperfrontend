/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/network-protocol`
 * Tests that the package sub-entries are requireable and exports work correctly,
 * and drives the v3 and v4 session envelope end to end: two protocol instances
 * bound to mirrored sessions exchange hellos, seal on one side, open on the
 * other, reject a replay, and a v4 pair holding different keys never authenticates.
 *
 * Note: network-protocol has many sub-entries for browser/node variants.
 * In Node.js environment, we test the node-specific entries.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

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

/** A plaintext packet as the package seals and opens it. */
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

/** Slice of a channel used by these tests. */
interface Channel {
  /** Sends data from an origin to a target through the seal stage. */
  send(origin: string, target: string, data: object): void
  /** Feeds a sealed frame into the open stage. */
  receive(frame: Uint8Array): void
  /** This side's plaintext hello frame. */
  hello(): Promise<Uint8Array>
  /** Feeds the peer's hello frame. */
  acceptHello(frame: Uint8Array): 'accepted' | 'duplicate' | 'rejected'
}

/** A packet a pipeline stage rejected. */
interface Drop {
  /** Whether the packet was leaving or arriving. */
  readonly direction: 'inbound' | 'outbound'
  /** The stage that rejected the packet. */
  readonly stage: 'seal' | 'open'
  /** Why the stage rejected it. */
  readonly reason: string
  /** The error the stage threw. */
  readonly cause?: unknown
}

/** One side of two channels wired together in memory. */
interface Party {
  /** The channel bound to this side's session. */
  readonly channel: Channel
  /** Every packet this side's pipeline delivered. */
  readonly received: Packet[]
  /** Every sealed frame this side posted. */
  readonly frames: Uint8Array[]
  /** Every drop this side's pipeline reported. */
  readonly drops: Drop[]
}

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

const INITIATOR_ID = '550e8400-e29b-41d4-a716-446655440000'
const RESPONDER_ID = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
const SHARED_KEY = 'e2e-shared-key-0123456789abcdef'
const OTHER_KEY = 'e2e-other-key-fedcba9876543210'

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
 * Builds a plaintext packet through the package's own data and packet factories.
 *
 * @param origin - The sender's identity.
 * @param target - The recipient's identity.
 * @param message - The message payload.
 * @returns The packet ready to seal.
 */
async function createPacket(origin: string, target: string, message: unknown): Promise<Packet> {
  const { createData, deserializeData } = require('@hyperfrontend/network-protocol/node/data')
  const { createUnencryptedPacket } = require('@hyperfrontend/network-protocol/node/packet')
  return createUnencryptedPacket(origin, target, deserializeData(await createData(origin, 1, message)))
}

/**
 * Runs a protocol operation and reads the protocol error code off what it throws or rejects with.
 *
 * @param operation - The operation being exercised.
 * @returns The error code, or null when the operation succeeded.
 */
async function rejectionCode(operation: () => unknown): Promise<string | null> {
  const { getProtocolErrorCode } = require('@hyperfrontend/network-protocol/security')
  try {
    await operation()
    return null
  } catch (error) {
    return getProtocolErrorCode(error)
  }
}

/**
 * Polls until a condition holds.
 *
 * @param condition - The condition to wait for.
 * @param attempts - How many 25 ms polls to allow.
 * @returns A promise resolved once the condition holds.
 */
async function waitFor(condition: () => boolean, attempts = 200): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for condition')
}

/**
 * Wires two channels together in memory over mirrored sessions and runs their hello exchange,
 * so each side's `send` posts straight into the other's inbound pipeline.
 *
 * @param protocol - The negotiated protocol id.
 * @param initiatorProvider - The provider building the initiating side.
 * @param responderProvider - The provider building the answering side.
 * @returns Both sides, connected.
 */
async function connectChannels(
  protocol: string,
  initiatorProvider: ProtocolProvider,
  responderProvider: ProtocolProvider
): Promise<{ initiator: Party; responder: Party }> {
  const { createChannel } = require('@hyperfrontend/network-protocol/node/channel')
  const pair = sessions(protocol)
  const wire: { initiator?: Channel; responder?: Channel } = {}
  const party = (role: 'initiator' | 'responder', protocolProvider: ProtocolProvider, peer: () => Channel | undefined): Party => {
    const received: Packet[] = []
    const frames: Uint8Array[] = []
    const drops: Drop[] = []
    const channel: Channel = createChannel(role, {
      send: (frame: Uint8Array) => {
        frames.push(frame)
        peer()?.receive(frame)
      },
      receive: (packet: Packet) => {
        received.push(packet)
      },
      protocolProvider,
      session: pair[role],
      onDrop: (drop: Drop) => {
        drops.push(drop)
      },
    })
    return { channel, received, frames, drops }
  }
  const initiator = party('initiator', initiatorProvider, () => wire.responder)
  const responder = party('responder', responderProvider, () => wire.initiator)
  wire.initiator = initiator.channel
  wire.responder = responder.channel
  responder.channel.acceptHello(await initiator.channel.hello())
  initiator.channel.acceptHello(await responder.channel.hello())
  return { initiator, responder }
}

describe('@hyperfrontend/network-protocol CJS', () => {
  describe('node/v3 sub-entry', () => {
    it('is requireable', () => {
      const v3 = require('@hyperfrontend/network-protocol/node/v3')
      expect(v3).toBeDefined()
    })

    it('exports createProtocol function', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      expect(typeof createProtocol).toBe('function')
    })

    it('exports the V3 definition', () => {
      const { V3 } = require('@hyperfrontend/network-protocol/node/v3')
      expect(V3).toEqual({ id: 'v3', version: 3 })
    })

    it('binds a provider to a v3 session', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const protocol = createProtocol(silentLogger)(noop, noop, sessions('v3').initiator)
      expect(protocol).toEqual(
        expect.objectContaining({
          seal: expect.any(Function),
          open: expect.any(Function),
          hello: expect.any(Function),
          isHello: expect.any(Function),
          acceptHello: expect.any(Function),
          send: noop,
          receive: noop,
        })
      )
    })

    it('refuses a session negotiated for another protocol with invalid-session', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      expect(await rejectionCode(() => provider(noop, noop, sessions('v4').initiator))).toBe('invalid-session')
    })

    it('emits a 99-byte plaintext hello carrying the version and hello type bytes', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const hello = await createProtocol(silentLogger)(noop, noop, sessions('v3').initiator).hello()
      expect({ length: hello.length, header: [...hello.subarray(0, 2)] }).toEqual({ length: 99, header: [3, 1] })
    })

    it('tells a hello frame apart from a sealed frame', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await link('v3', provider, provider)
      const sealed = await initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'PING' }))
      expect([initiator.isHello(await responder.hello()), initiator.isHello(sealed)]).toEqual([true, false])
    })

    it('accepts the peer hello once and reports its retry as a duplicate', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const pair = sessions('v3')
      const initiator = provider(noop, noop, pair.initiator)
      const responderHello = await provider(noop, noop, pair.responder).hello()
      expect([initiator.acceptHello(responderHello), initiator.acceptHello(responderHello)]).toEqual(['accepted', 'duplicate'])
    })

    it('rejects a hello from a third instance once the session is keyed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const pair = sessions('v3')
      const initiator = provider(noop, noop, pair.initiator)
      initiator.acceptHello(await provider(noop, noop, pair.responder).hello())
      expect(initiator.acceptHello(await provider(noop, noop, pair.responder).hello())).toBe('rejected')
    })

    it('opens on the responder the packet the initiator sealed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await link('v3', provider, provider)
      const packet = await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'PING' })
      expect(await responder.open(await initiator.seal(packet))).toEqual(packet)
    })

    it('opens on the initiator the packet the responder sealed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await link('v3', provider, provider)
      const packet = await createPacket(RESPONDER_ID, INITIATOR_ID, { type: 'PONG' })
      expect(await initiator.open(await responder.seal(packet))).toEqual(packet)
    })

    it('keeps the message out of the sealed frame', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator } = await link('v3', provider, provider)
      const frame = await initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { secret: 'E2E-PLAINTEXT' }))
      expect(new TextDecoder().decode(frame)).not.toContain('E2E-PLAINTEXT')
    })

    it('rejects a replayed frame with the replayed code', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await link('v3', provider, provider)
      const frame = await initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'ONCE' }))
      await responder.open(frame)
      expect(await rejectionCode(() => responder.open(frame))).toBe('replayed')
    })

    it('rejects a frame sealed in another session of the same peers with authentication-failed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const stale = await link('v3', provider, provider)
      const fresh = await link('v3', provider, provider)
      const frame = await stale.initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'OLD' }))
      expect(await rejectionCode(() => fresh.responder.open(frame))).toBe('authentication-failed')
    })

    it('rejects a frame shorter than 27 bytes as malformed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const responder = createProtocol(silentLogger)(noop, noop, sessions('v3').responder)
      expect(await rejectionCode(() => responder.open(new Uint8Array(26)))).toBe('malformed')
    })

    it('rejects a frame carrying another version byte with unsupported-version', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const responder = createProtocol(silentLogger)(noop, noop, sessions('v3').responder)
      // note: A v4 data-frame header with counter 1 in front of enough bytes to pass the length check.
      const frame = new Uint8Array(27)
      frame[0] = 4
      frame[9] = 1
      expect(await rejectionCode(() => responder.open(frame))).toBe('unsupported-version')
    })
  })

  describe('node/v4 sub-entry', () => {
    it('is requireable', () => {
      const v4 = require('@hyperfrontend/network-protocol/node/v4')
      expect(v4).toBeDefined()
    })

    it('exports createProtocol function', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      expect(typeof createProtocol).toBe('function')
    })

    it('exports the V4 definition', () => {
      const { V4 } = require('@hyperfrontend/network-protocol/node/v4')
      expect(V4).toEqual({ id: 'v4', version: 4 })
    })

    it('exports a 16-character minimum shared key length', () => {
      const { MIN_SHARED_KEY_LENGTH } = require('@hyperfrontend/network-protocol/node/v4')
      expect(MIN_SHARED_KEY_LENGTH).toBe(16)
    })

    it('validates a shared key against the minimum length', () => {
      const { isValidSharedKey } = require('@hyperfrontend/network-protocol/node/v4')
      expect([isValidSharedKey('0123456789abcdef'), isValidSharedKey('0123456789abcde')]).toEqual([true, false])
    })

    it('throws when the shared key is shorter than 16 characters', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      expect(() => createProtocol(silentLogger, 'short-key')).toThrow()
    })

    it('emits a hello carrying version byte 4', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      const hello = await createProtocol(silentLogger, SHARED_KEY)(noop, noop, sessions('v4').initiator).hello()
      expect([...hello.subarray(0, 2)]).toEqual([4, 1])
    })

    it('opens on the responder the packet the initiator sealed under the same key', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      const { initiator, responder } = await link('v4', createProtocol(silentLogger, SHARED_KEY), createProtocol(silentLogger, SHARED_KEY))
      const packet = await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'PING' })
      expect(await responder.open(await initiator.seal(packet))).toEqual(packet)
    })

    it('rejects a replayed frame with the replayed code', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      const { initiator, responder } = await link('v4', createProtocol(silentLogger, SHARED_KEY), createProtocol(silentLogger, SHARED_KEY))
      const frame = await initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'ONCE' }))
      await responder.open(frame)
      expect(await rejectionCode(() => responder.open(frame))).toBe('replayed')
    })

    it('rejects every frame from a side holding a different key with authentication-failed', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v4')
      const { initiator, responder } = await link('v4', createProtocol(silentLogger, OTHER_KEY), createProtocol(silentLogger, SHARED_KEY))
      const frame = await initiator.seal(await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'PING' }))
      expect(await rejectionCode(() => responder.open(frame))).toBe('authentication-failed')
    })
  })

  describe('node/channel sub-entry', () => {
    it('is requireable', () => {
      const channel = require('@hyperfrontend/network-protocol/node/channel')
      expect(channel).toBeDefined()
    })

    it('delivers a packet through two channels bound to one v3 session', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await connectChannels('v3', provider, provider)
      const packet = await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'PING' })
      initiator.channel.send(packet.origin, packet.target, packet.data)
      await waitFor(() => responder.received.length === 1)
      expect(responder.received[0]).toEqual(packet)
    })

    it('reports a replayed frame to onDrop with the replayed code', async () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
      const provider = createProtocol(silentLogger)
      const { initiator, responder } = await connectChannels('v3', provider, provider)
      const packet = await createPacket(INITIATOR_ID, RESPONDER_ID, { type: 'ONCE' })
      initiator.channel.send(packet.origin, packet.target, packet.data)
      await waitFor(() => responder.received.length === 1)
      responder.channel.receive(initiator.frames[0])
      await waitFor(() => responder.drops.length === 1)
      expect(responder.drops[0]).toEqual(
        expect.objectContaining({ direction: 'inbound', stage: 'open', cause: expect.objectContaining({ code: 'replayed' }) })
      )
    })
  })

  describe('node/data sub-entry', () => {
    it('is requireable', () => {
      const data = require('@hyperfrontend/network-protocol/node/data')
      expect(data).toBeDefined()
    })
  })

  describe('node/packet sub-entry', () => {
    it('is requireable', () => {
      const packet = require('@hyperfrontend/network-protocol/node/packet')
      expect(packet).toBeDefined()
    })
  })

  describe('node/sender sub-entry', () => {
    it('is requireable', () => {
      const sender = require('@hyperfrontend/network-protocol/node/sender')
      expect(sender).toBeDefined()
    })
  })

  describe('node/receiver sub-entry', () => {
    it('is requireable', () => {
      const receiver = require('@hyperfrontend/network-protocol/node/receiver')
      expect(receiver).toBeDefined()
    })
  })

  describe('queue sub-entry (shared)', () => {
    it('is requireable', () => {
      const queue = require('@hyperfrontend/network-protocol/queue')
      expect(queue).toBeDefined()
    })
  })

  describe('routing sub-entry (shared)', () => {
    it('is requireable', () => {
      const routing = require('@hyperfrontend/network-protocol/routing')
      expect(routing).toBeDefined()
    })
  })

  describe('security sub-entry (shared)', () => {
    it('is requireable', () => {
      const security = require('@hyperfrontend/network-protocol/security')
      expect(security).toBeDefined()
    })

    it('exports the six protocol error codes', () => {
      const { ProtocolErrorCode } = require('@hyperfrontend/network-protocol/security')
      expect(ProtocolErrorCode).toEqual({
        UnsupportedVersion: 'unsupported-version',
        Replayed: 'replayed',
        AuthenticationFailed: 'authentication-failed',
        Malformed: 'malformed',
        CounterExhausted: 'counter-exhausted',
        InvalidSession: 'invalid-session',
      })
    })
  })

  describe('topic sub-entry (shared)', () => {
    it('is requireable', () => {
      const topic = require('@hyperfrontend/network-protocol/topic')
      expect(topic).toBeDefined()
    })
  })
})
