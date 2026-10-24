import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, waitUntil } from '@hyperfrontend/testing'
import { createProtocol as createBrowserV3 } from '../browser/v3'
import { createProtocol as createBrowserV4 } from '../browser/v4'
import { createProtocol as createNodeV3 } from '../node/v3'
import { createProtocol as createNodeV4 } from '../node/v4'
import { connectPair } from './harness'

// magic: real WebCrypto handshakes run on the real clock, and 5s at a 25ms poll is the budget the suite has always allowed them.
const PATIENCE = { timeout: 5000, interval: 25 }

const SHARED_KEY = 'integration-test-shared-secret-key-2026'

describe('Session envelope over in-memory channels (browser)', () => {
  describe('v3', () => {
    it('delivers messages in both directions', async () => {
      const { initiator, responder } = await connectPair('v3', createBrowserV3(logger), createBrowserV3(logger))
      await initiator.send({ type: 'PING' })
      await responder.send({ type: 'PONG' })
      await waitUntil(() => initiator.received.length === 1 && responder.received.length === 1, PATIENCE)
      expect({ atInitiator: initiator.received[0].message, atResponder: responder.received[0].message }).toEqual({
        atInitiator: { type: 'PONG' },
        atResponder: { type: 'PING' },
      })
    })

    it('puts only sealed frames on the wire', async () => {
      const { initiator, responder } = await connectPair('v3', createBrowserV3(logger), createBrowserV3(logger))
      await initiator.send({ type: 'SECRET' })
      await waitUntil(() => responder.received.length === 1, PATIENCE)
      expect(initiator.frames.map((frame) => new TextDecoder().decode(frame).includes('SECRET'))).toEqual([false])
    })

    it('keeps order across a burst', async () => {
      const { initiator, responder } = await connectPair('v3', createBrowserV3(logger), createBrowserV3(logger))
      for (let i = 0; i < 20; i++) {
        await initiator.send({ i })
      }
      await waitUntil(() => responder.received.length === 20, PATIENCE)
      expect(responder.received.map((data) => (data.message as { i: number }).i)).toEqual([...Array(20).keys()])
    })

    it('rejects a replayed frame and reports it as a drop', async () => {
      const { initiator, responder } = await connectPair('v3', createBrowserV3(logger), createBrowserV3(logger))
      await initiator.send({ type: 'ONCE' })
      await waitUntil(() => responder.received.length === 1, PATIENCE)
      responder.channel.receive(initiator.frames[0])
      await waitUntil(() => responder.drops.length === 1, PATIENCE)
      expect(responder.drops[0]).toEqual(
        expect.objectContaining({ direction: 'inbound', stage: 'open', cause: expect.objectContaining({ code: 'replayed' }) })
      )
    })

    it('rejects a frame from a previous session of the same peers', async () => {
      const provider = createBrowserV3(logger)
      const stale = await connectPair('v3', provider, provider)
      const fresh = await connectPair('v3', provider, provider)
      await stale.initiator.send({ type: 'OLD' })
      await waitUntil(() => stale.initiator.frames.length === 1, PATIENCE)
      fresh.responder.channel.receive(stale.initiator.frames[0])
      await waitUntil(() => fresh.responder.drops.length === 1, PATIENCE)
      expect(fresh.responder.drops[0].cause).toEqual(expect.objectContaining({ code: 'authentication-failed' }))
    })
  })

  describe('v4', () => {
    it('delivers messages between two sides holding the same key', async () => {
      const { initiator, responder } = await connectPair('v4', createBrowserV4(logger, SHARED_KEY), createBrowserV4(logger, SHARED_KEY))
      await initiator.send({ type: 'PING' })
      await waitUntil(() => responder.received.length === 1, PATIENCE)
      expect(responder.received[0].message).toEqual({ type: 'PING' })
    })

    it('drops every frame from a side holding a different key', async () => {
      const { initiator, responder } = await connectPair(
        'v4',
        createBrowserV4(logger, 'another-shared-key-that-is-long'),
        createBrowserV4(logger, SHARED_KEY)
      )
      await initiator.send({ type: 'PING' })
      await waitUntil(() => responder.drops.length === 1, PATIENCE)
      expect({ delivered: responder.received.length, code: (responder.drops[0].cause as { code: string }).code }).toEqual({
        delivered: 0,
        code: 'authentication-failed',
      })
    })
  })

  describe('cross-platform', () => {
    it('lets a browser-composed initiator talk to a node-composed responder over v3', async () => {
      const { initiator, responder } = await connectPair('v3', createBrowserV3(logger), createNodeV3(logger))
      await initiator.send({ type: 'PING' })
      await responder.send({ type: 'PONG' })
      await waitUntil(() => initiator.received.length === 1 && responder.received.length === 1, PATIENCE)
      expect(initiator.received[0].message).toEqual({ type: 'PONG' })
    })

    it('lets a node-composed initiator talk to a browser-composed responder over v4', async () => {
      const { initiator, responder } = await connectPair('v4', createNodeV4(logger, SHARED_KEY), createBrowserV4(logger, SHARED_KEY))
      await initiator.send({ type: 'PING' })
      await responder.send({ type: 'PONG' })
      await waitUntil(() => initiator.received.length === 1 && responder.received.length === 1, PATIENCE)
      expect(responder.received[0].message).toEqual({ type: 'PING' })
    })
  })
})
