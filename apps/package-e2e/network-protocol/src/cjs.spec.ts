/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/network-protocol`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks. Each suite drives one scenario in a child process and reads the facts it reports: two v3 instances
 * bound to mirrored sessions exchange hellos, seal on one side, open on the other and reject a replay; a v4 pair
 * holding different keys never authenticates; two channels deliver a packet and report a replayed frame as a drop.
 */

'use strict'

const { before } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

/** What one v3 scenario reports. */
interface V3Facts {
  /** The methods a bound protocol instance carries. */
  methods: string[]
  /** The error code of binding a provider to a v4 session. */
  otherProtocol: string | null
  /** The byte length of a hello frame and its two leading bytes. */
  hello: { length: number; header: number[] }
  /** Whether `isHello` recognises a hello and a sealed frame, in that order. */
  helloVersusSealed: boolean[]
  /** What `acceptHello` answered to the same peer hello twice, then to a third instance's hello. */
  accepts: string[]
  /** Whether the responder opened what the initiator sealed, and the initiator what the responder sealed. */
  roundTrips: boolean[]
  /** Whether the message text appears in the sealed frame. */
  plaintextLeaked: boolean
  /** The error codes of a replayed frame, a frame from a stale session, a short frame and a frame of another version. */
  rejections: Array<string | null>
}

/** What one v4 scenario reports. */
interface V4Facts {
  /** The definition and the minimum shared key length. */
  definition: { V4: unknown; MIN_SHARED_KEY_LENGTH: number }
  /** Whether a 16-character key is valid and a 15-character one is not. */
  keyLengths: boolean[]
  /** Whether `createProtocol` threw for a short key. */
  shortKeyRefused: boolean
  /** The two leading bytes of a hello frame. */
  helloHeader: number[]
  /** Whether the responder opened what the initiator sealed under the same key. */
  roundTrip: boolean
  /** The error codes of a replayed frame and of a frame sealed under another key. */
  rejections: Array<string | null>
}

/** What two channels bound to one v3 session report. */
interface ChannelFacts {
  /** Whether the packet the responder received equals the one the initiator sent. */
  delivered: boolean
  /** The drop the responder reported for a replayed frame. */
  drop: unknown
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/network-protocol CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exports the V3 definition', () => {
    const definition = consumer.run(() => require('@hyperfrontend/network-protocol/node/v3').V3, { kind: 'require' })
    expect(definition).toEqual({ id: 'v3', version: 3 })
  })

  it('exports the six protocol error codes', () => {
    const codes = consumer.run(() => require('@hyperfrontend/network-protocol/security').ProtocolErrorCode, { kind: 'require' })
    expect(codes).toEqual({
      UnsupportedVersion: 'unsupported-version',
      Replayed: 'replayed',
      AuthenticationFailed: 'authentication-failed',
      Malformed: 'malformed',
      CounterExhausted: 'counter-exhausted',
      InvalidSession: 'invalid-session',
    })
  })

  describe('two v3 instances bound to mirrored sessions', () => {
    let facts: V3Facts

    before(() => {
      facts = consumer.run(
        async () => {
          const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
          const { createData, deserializeData } = require('@hyperfrontend/network-protocol/node/data')
          const { createUnencryptedPacket } = require('@hyperfrontend/network-protocol/node/packet')
          const { getProtocolErrorCode } = require('@hyperfrontend/network-protocol/security')
          const noop = () => undefined
          const logger: Parameters<typeof createProtocol>[0] = {
            log: noop,
            warn: noop,
            error: noop,
            info: noop,
            debug: noop,
            setLogLevel: noop,
            getLogLevel: () => 'info',
            channel: () => logger,
            timed: (_label, fn) => fn(),
            timedAsync: (_label, fn) => fn(),
          }
          const INITIATOR = '550e8400-e29b-41d4-a716-446655440000'
          const RESPONDER = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
          const sessions = (protocol: string) => ({
            initiator: { protocol, role: 'initiator' as const, localId: INITIATOR, peerId: RESPONDER },
            responder: { protocol, role: 'responder' as const, localId: RESPONDER, peerId: INITIATOR },
          })
          const provider = createProtocol(logger)
          const link = async () => {
            const pair = sessions('v3')
            const initiator = provider(noop, noop, pair.initiator)
            const responder = provider(noop, noop, pair.responder)
            responder.acceptHello(await initiator.hello())
            initiator.acceptHello(await responder.hello())
            return { initiator, responder }
          }
          const packet = async (origin: string, target: string, message: unknown) =>
            createUnencryptedPacket(origin, target, deserializeData(await createData(origin, 1, message)))
          const code = async (operation: () => unknown) => {
            try {
              await operation()
              return null
            } catch (error) {
              return getProtocolErrorCode(error)
            }
          }
          const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

          const bound = provider(noop, noop, sessions('v3').initiator)
          const hello = await bound.hello()
          const linked = await link()
          const ping = await packet(INITIATOR, RESPONDER, { type: 'PING' })
          const pong = await packet(RESPONDER, INITIATOR, { type: 'PONG' })
          const sealed = await linked.initiator.seal(ping)
          const opened = await linked.responder.open(sealed)
          const openedBack = await linked.initiator.open(await linked.responder.seal(pong))
          const secret = await linked.initiator.seal(await packet(INITIATOR, RESPONDER, { secret: 'E2E-PLAINTEXT' }))
          const pair = sessions('v3')
          const initiator = provider(noop, noop, pair.initiator)
          const responderHello = await provider(noop, noop, pair.responder).hello()
          const accepts = [initiator.acceptHello(responderHello), initiator.acceptHello(responderHello)]
          accepts.push(initiator.acceptHello(await provider(noop, noop, pair.responder).hello()))
          const stale = await link()
          const fresh = await link()
          const staleFrame = await stale.initiator.seal(await packet(INITIATOR, RESPONDER, { type: 'OLD' }))
          const lone = provider(noop, noop, sessions('v3').responder)
          // note: a v4 data-frame header with counter 1 in front of enough bytes to pass the length check.
          const otherVersion = new Uint8Array(27)
          otherVersion[0] = 4
          otherVersion[9] = 1

          return {
            methods: ['seal', 'open', 'hello', 'isHello', 'acceptHello', 'send', 'receive'].filter(
              (name) => typeof (bound as unknown as Record<string, unknown>)[name] === 'function'
            ),
            otherProtocol: await code(() => provider(noop, noop, sessions('v4').initiator)),
            hello: { length: hello.length, header: [...hello.subarray(0, 2)] },
            helloVersusSealed: [linked.initiator.isHello(await linked.responder.hello()), linked.initiator.isHello(sealed)],
            accepts,
            roundTrips: [same(opened, ping), same(openedBack, pong)],
            plaintextLeaked: new TextDecoder().decode(secret).includes('E2E-PLAINTEXT'),
            rejections: [
              await code(() => linked.responder.open(sealed)),
              await code(() => fresh.responder.open(staleFrame)),
              await code(() => lone.open(new Uint8Array(26))),
              await code(() => lone.open(otherVersion)),
            ],
          }
        },
        { kind: 'require' }
      )
    })

    it('binds a provider to a session carrying the protocol methods', () => {
      expect(facts.methods).toEqual(['seal', 'open', 'hello', 'isHello', 'acceptHello', 'send', 'receive'])
    })

    it('refuses a session negotiated for another protocol with invalid-session', () => {
      expect(facts.otherProtocol).toBe('invalid-session')
    })

    it('emits a 99-byte plaintext hello carrying the version and hello type bytes', () => {
      expect(facts.hello).toEqual({ length: 99, header: [3, 1] })
    })

    it('tells a hello frame apart from a sealed frame', () => {
      expect(facts.helloVersusSealed).toEqual([true, false])
    })

    it('accepts the peer hello once, reports its retry as a duplicate and rejects a third instance once keyed', () => {
      expect(facts.accepts).toEqual(['accepted', 'duplicate', 'rejected'])
    })

    it('opens on each side the packet the other sealed', () => {
      expect(facts.roundTrips).toEqual([true, true])
    })

    it('keeps the message out of the sealed frame', () => {
      expect(facts.plaintextLeaked).toBe(false)
    })

    it('rejects a replay, a stale session, a short frame and another version with their codes', () => {
      expect(facts.rejections).toEqual(['replayed', 'authentication-failed', 'malformed', 'unsupported-version'])
    })
  })

  describe('two v4 instances holding shared keys', () => {
    let facts: V4Facts

    before(() => {
      facts = consumer.run(
        async () => {
          const { MIN_SHARED_KEY_LENGTH, V4, createProtocol, isValidSharedKey } = require('@hyperfrontend/network-protocol/node/v4')
          const { createData, deserializeData } = require('@hyperfrontend/network-protocol/node/data')
          const { createUnencryptedPacket } = require('@hyperfrontend/network-protocol/node/packet')
          const { getProtocolErrorCode } = require('@hyperfrontend/network-protocol/security')
          const noop = () => undefined
          const logger: Parameters<typeof createProtocol>[0] = {
            log: noop,
            warn: noop,
            error: noop,
            info: noop,
            debug: noop,
            setLogLevel: noop,
            getLogLevel: () => 'info',
            channel: () => logger,
            timed: (_label, fn) => fn(),
            timedAsync: (_label, fn) => fn(),
          }
          const INITIATOR = '550e8400-e29b-41d4-a716-446655440000'
          const RESPONDER = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
          const SHARED_KEY = 'e2e-shared-key-0123456789abcdef'
          const OTHER_KEY = 'e2e-other-key-fedcba9876543210'
          const sessions = () => ({
            initiator: { protocol: 'v4', role: 'initiator' as const, localId: INITIATOR, peerId: RESPONDER },
            responder: { protocol: 'v4', role: 'responder' as const, localId: RESPONDER, peerId: INITIATOR },
          })
          const link = async (initiatorKey: string, responderKey: string) => {
            const pair = sessions()
            const initiator = createProtocol(logger, initiatorKey)(noop, noop, pair.initiator)
            const responder = createProtocol(logger, responderKey)(noop, noop, pair.responder)
            responder.acceptHello(await initiator.hello())
            initiator.acceptHello(await responder.hello())
            return { initiator, responder }
          }
          const packet = async (message: unknown) =>
            createUnencryptedPacket(INITIATOR, RESPONDER, deserializeData(await createData(INITIATOR, 1, message)))
          const code = async (operation: () => unknown) => {
            try {
              await operation()
              return null
            } catch (error) {
              return getProtocolErrorCode(error)
            }
          }
          let shortKeyRefused = false
          try {
            createProtocol(logger, 'short-key')
          } catch {
            shortKeyRefused = true
          }
          const hello = await createProtocol(logger, SHARED_KEY)(noop, noop, sessions().initiator).hello()
          const same = await link(SHARED_KEY, SHARED_KEY)
          const ping = await packet({ type: 'PING' })
          const frame = await same.initiator.seal(ping)
          const opened = await same.responder.open(frame)
          const mismatched = await link(OTHER_KEY, SHARED_KEY)
          const foreign = await mismatched.initiator.seal(await packet({ type: 'PING' }))

          return {
            definition: { V4, MIN_SHARED_KEY_LENGTH },
            keyLengths: [isValidSharedKey('0123456789abcdef'), isValidSharedKey('0123456789abcde')],
            shortKeyRefused,
            helloHeader: [...hello.subarray(0, 2)],
            roundTrip: JSON.stringify(opened) === JSON.stringify(ping),
            rejections: [await code(() => same.responder.open(frame)), await code(() => mismatched.responder.open(foreign))],
          }
        },
        { kind: 'require' }
      )
    })

    it('exports the V4 definition and a 16-character minimum shared key length', () => {
      expect(facts.definition).toEqual({ V4: { id: 'v4', version: 4 }, MIN_SHARED_KEY_LENGTH: 16 })
    })

    it('validates a shared key against the minimum length', () => {
      expect(facts.keyLengths).toEqual([true, false])
    })

    it('throws when the shared key is shorter than 16 characters', () => {
      expect(facts.shortKeyRefused).toBe(true)
    })

    it('emits a hello carrying version byte 4', () => {
      expect(facts.helloHeader).toEqual([4, 1])
    })

    it('opens on the responder the packet the initiator sealed under the same key', () => {
      expect(facts.roundTrip).toBe(true)
    })

    it('rejects a replayed frame and every frame from a side holding a different key', () => {
      expect(facts.rejections).toEqual(['replayed', 'authentication-failed'])
    })
  })

  describe('two channels bound to one v3 session', () => {
    let facts: ChannelFacts

    before(() => {
      facts = consumer.run(
        async () => {
          const { createChannel } = require('@hyperfrontend/network-protocol/node/channel')
          const { createProtocol } = require('@hyperfrontend/network-protocol/node/v3')
          const { createData, deserializeData } = require('@hyperfrontend/network-protocol/node/data')
          const { createUnencryptedPacket } = require('@hyperfrontend/network-protocol/node/packet')
          const noop = () => undefined
          const logger: Parameters<typeof createProtocol>[0] = {
            log: noop,
            warn: noop,
            error: noop,
            info: noop,
            debug: noop,
            setLogLevel: noop,
            getLogLevel: () => 'info',
            channel: () => logger,
            timed: (_label, fn) => fn(),
            timedAsync: (_label, fn) => fn(),
          }
          const INITIATOR = '550e8400-e29b-41d4-a716-446655440000'
          const RESPONDER = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
          const provider = createProtocol(logger)
          const waitFor = async (condition: () => boolean) => {
            for (let attempt = 0; attempt < 200 && !condition(); attempt++) await new Promise((resolve) => setTimeout(resolve, 25))
            if (!condition()) throw new Error('Timed out waiting for condition')
          }
          const wire: { initiator?: ReturnType<typeof createChannel>; responder?: ReturnType<typeof createChannel> } = {}
          const party = (role: 'initiator' | 'responder', peer: () => ReturnType<typeof createChannel> | undefined) => {
            const received: unknown[] = []
            const frames: Uint8Array[] = []
            const drops: unknown[] = []
            const channel = createChannel(role, {
              send: (frame) => {
                frames.push(frame)
                peer()?.receive(frame)
              },
              receive: (packet) => {
                received.push(packet)
              },
              protocolProvider: provider,
              session:
                role === 'initiator'
                  ? { protocol: 'v3', role, localId: INITIATOR, peerId: RESPONDER }
                  : { protocol: 'v3', role, localId: RESPONDER, peerId: INITIATOR },
              onDrop: (drop) => {
                drops.push(drop)
              },
            })
            return { channel, received, frames, drops }
          }
          const initiator = party('initiator', () => wire.responder)
          const responder = party('responder', () => wire.initiator)
          wire.initiator = initiator.channel
          wire.responder = responder.channel
          responder.channel.acceptHello(await initiator.channel.hello())
          initiator.channel.acceptHello(await responder.channel.hello())
          const packet = createUnencryptedPacket(INITIATOR, RESPONDER, deserializeData(await createData(INITIATOR, 1, { type: 'PING' })))
          initiator.channel.send(packet.origin, packet.target, packet.data)
          await waitFor(() => responder.received.length === 1)
          responder.channel.receive(initiator.frames[0] as Uint8Array)
          await waitFor(() => responder.drops.length === 1)
          return { delivered: JSON.stringify(responder.received[0]) === JSON.stringify(packet), drop: responder.drops[0] }
        },
        { kind: 'require' }
      )
    })

    it('delivers a packet from one channel to the other', () => {
      expect(facts.delivered).toBe(true)
    })

    it('reports a replayed frame to onDrop with the replayed code', () => {
      expect(facts.drop).toEqual(
        expect.objectContaining({ direction: 'inbound', stage: 'open', cause: expect.objectContaining({ code: 'replayed' }) })
      )
    })
  })
})
