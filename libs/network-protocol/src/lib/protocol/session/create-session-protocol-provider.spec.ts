/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UnencryptedPacket } from '../../packet/model'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { data } from '../../data/creators/mocks'
import { createSessionProtocolProvider } from './create-session-protocol-provider'
import { V3 } from './create-v3-protocol-factory'
import { V4 } from './create-v4-protocol-factory'
import { createMockLogger, ids, link, nodeCrypto, sessions, SHARED_KEY } from './test-fixtures'

const packet: UnencryptedPacket = { origin: ids.initiator, target: ids.responder, data: { ...data, message: { content: 'hello' } } }
const noop = () => void 0

describe('createSessionProtocolProvider', () => {
  it('throws without a valid logger', () => {
    expect(() => createSessionProtocolProvider(nodeCrypto, V3, {} as any)).toThrow('Cannot create protocol provider without a valid logger')
  })

  describe('provider validation', () => {
    const provider = createSessionProtocolProvider(nodeCrypto, V3, createMockLogger())

    it('throws without a valid send function', () => {
      expect(() => provider(null as any, noop, sessions('v3').initiator)).toThrow('Cannot create protocol without a valid send function')
    })

    it('throws without a valid receive function', () => {
      expect(() => provider(noop, null as any, sessions('v3').initiator)).toThrow('Cannot create protocol without a valid receive function')
    })

    it('refuses a session negotiated for another protocol', () => {
      expect(() => provider(noop, noop, sessions('v4').initiator)).toThrow("The session was negotiated for 'v4', not 'v3'")
    })

    it('returns a protocol bound to the transport callbacks', () => {
      const send = () => void 0
      const receive = () => void 0
      expect(provider(send, receive, sessions('v3').initiator)).toEqual(
        expect.objectContaining({
          seal: expect.any(Function),
          open: expect.any(Function),
          hello: expect.any(Function),
          isHello: expect.any(Function),
          acceptHello: expect.any(Function),
          send,
          receive,
          getLogger: expect.any(Function),
        })
      )
    })
  })

  describe('v3 sessions', () => {
    const providerA = createSessionProtocolProvider(nodeCrypto, V3, createMockLogger())
    const providerB = createSessionProtocolProvider(nodeCrypto, V3, createMockLogger())

    it('lets the responder open what the initiator sealed', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      await expect(responder.open(await initiator.seal(packet))).resolves.toEqual(packet)
    })

    it('lets the initiator open what the responder sealed', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      await expect(initiator.open(await responder.seal({ ...packet, origin: ids.responder, target: ids.initiator }))).resolves.toEqual(
        expect.objectContaining({ origin: ids.responder })
      )
    })

    it('starts the frame counter at one and increments it', async () => {
      const { initiator } = await link('v3', providerA, providerB)
      const [first, second] = [await initiator.seal(packet), await initiator.seal(packet)]
      expect([first[9], second[9]]).toEqual([1, 2])
    })

    it('stamps every frame with the v3 version byte', async () => {
      const { initiator } = await link('v3', providerA, providerB)
      expect((await initiator.seal(packet))[0]).toBe(3)
    })

    it('rejects a replayed frame before decrypting it', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      const frame = await initiator.seal(packet)
      await responder.open(frame)
      await expect(responder.open(frame)).rejects.toThrow(expect.objectContaining({ code: 'replayed' }))
    })

    it('accepts a later frame after an earlier one was dropped', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      await initiator.seal(packet)
      await expect(responder.open(await initiator.seal(packet))).resolves.toEqual(packet)
    })

    it('rejects a frame sealed for the other direction', async () => {
      const { responder } = await link('v3', providerA, providerB)
      await expect(responder.open(await responder.seal(packet))).rejects.toThrow(expect.objectContaining({ code: 'authentication-failed' }))
    })

    it('rejects a tampered frame', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      const frame = await initiator.seal(packet)
      frame[frame.length - 1] ^= 1
      await expect(responder.open(frame)).rejects.toThrow(expect.objectContaining({ code: 'authentication-failed' }))
    })

    it('rejects a frame whose counter was altered', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      const frame = await initiator.seal(packet)
      frame[9] = 9
      await expect(responder.open(frame)).rejects.toThrow(expect.objectContaining({ code: 'authentication-failed' }))
    })

    it('rejects a frame from another session', async () => {
      const stale = await link('v3', providerA, providerB)
      const fresh = await link('v3', providerA, providerB)
      await expect(fresh.responder.open(await stale.initiator.seal(packet))).rejects.toThrow(
        expect.objectContaining({ code: 'authentication-failed' })
      )
    })

    it('rejects a frame carrying another version byte', async () => {
      const { initiator, responder } = await link('v3', providerA, providerB)
      const frame = await initiator.seal(packet)
      frame[0] = 4
      await expect(responder.open(frame)).rejects.toThrow(expect.objectContaining({ code: 'unsupported-version' }))
    })

    it('rejects a frame too short to carry a packet', async () => {
      const { responder } = await link('v3', providerA, providerB)
      await expect(responder.open(new Uint8Array(20))).rejects.toThrow(expect.objectContaining({ code: 'malformed' }))
    })

    it('reports a peer public key that is not on the curve as an invalid session', async () => {
      const initiator = providerA(noop, noop, sessions('v3').initiator)
      const hello = await providerB(noop, noop, sessions('v3').responder).hello()
      hello.fill(0, 35)
      initiator.acceptHello(hello)
      await expect(initiator.seal(packet)).rejects.toThrow(expect.objectContaining({ code: 'invalid-session' }))
    })
  })

  describe('hello exchange', () => {
    const provider = createSessionProtocolProvider(nodeCrypto, V3, createMockLogger())

    it('produces the same hello on every call', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      expect(await protocol.hello()).toEqual(await protocol.hello())
    })

    it('recognises its own protocol version as a hello', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      expect(protocol.isHello(await protocol.hello())).toBe(true)
    })

    it('does not treat a hello of another version as its own', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      const hello = await protocol.hello()
      hello[0] = 4
      expect(protocol.isHello(hello)).toBe(false)
    })

    it('accepts the first hello of the peer', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      expect(protocol.acceptHello(await provider(noop, noop, sessions('v3').responder).hello())).toBe('accepted')
    })

    it('treats the same hello again as a duplicate', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      const hello = await provider(noop, noop, sessions('v3').responder).hello()
      protocol.acceptHello(hello)
      expect(protocol.acceptHello(hello)).toBe('duplicate')
    })

    it('rejects a different hello once one was accepted', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      protocol.acceptHello(await provider(noop, noop, sessions('v3').responder).hello())
      expect(protocol.acceptHello(await provider(noop, noop, sessions('v3').responder).hello())).toBe('rejected')
    })

    it('rejects bytes that are not a hello', () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      expect(protocol.acceptHello(new Uint8Array(99))).toBe('rejected')
    })

    it('rejects a hello whose public key is not tagged as a point', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      const hello = await provider(noop, noop, sessions('v3').responder).hello()
      hello[34] = 0
      expect(protocol.acceptHello(hello)).toBe('rejected')
    })

    it('keeps sealing on hold until the peer says hello', async () => {
      const protocol = provider(noop, noop, sessions('v3').initiator)
      let settled = false
      const sealing = protocol.seal(packet).then(() => (settled = true))
      await new Promise((resolve) => setTimeout(resolve, 30))
      const held = settled
      protocol.acceptHello(await provider(noop, noop, sessions('v3').responder).hello())
      await sealing
      expect({ held, settled }).toEqual({ held: false, settled: true })
    })
  })

  describe('v4 sessions', () => {
    let providerA: ReturnType<typeof createSessionProtocolProvider>
    let providerB: ReturnType<typeof createSessionProtocolProvider>

    beforeAll(() => {
      providerA = createSessionProtocolProvider(nodeCrypto, { ...V4, sharedKey: SHARED_KEY }, createMockLogger())
      providerB = createSessionProtocolProvider(nodeCrypto, { ...V4, sharedKey: SHARED_KEY }, createMockLogger())
    })

    it('lets two sides holding the same key exchange packets', async () => {
      const { initiator, responder } = await link('v4', providerA, providerB)
      await expect(responder.open(await initiator.seal(packet))).resolves.toEqual(packet)
    })

    it('stamps every frame with the v4 version byte', async () => {
      const { initiator } = await link('v4', providerA, providerB)
      expect((await initiator.seal(packet))[0]).toBe(4)
    })

    it('rejects frames from a side holding a different key', async () => {
      const impostor = createSessionProtocolProvider(nodeCrypto, { ...V4, sharedKey: 'a-different-shared-key-0123' }, createMockLogger())
      const { initiator, responder } = await link('v4', impostor, providerB)
      await expect(responder.open(await initiator.seal(packet))).rejects.toThrow(expect.objectContaining({ code: 'authentication-failed' }))
    })
  })
})
