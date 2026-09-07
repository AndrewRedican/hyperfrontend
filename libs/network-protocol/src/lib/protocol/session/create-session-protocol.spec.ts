import type { UnencryptedPacket } from '../../packet/model'
import type { SessionCrypto } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { data } from '../../data/creators/mocks'
import { createSessionProtocol } from './create-session-protocol'
import { V3 } from './create-v3-protocol-factory'
import { createMockLogger, ids, nodeCrypto, sessions } from './test-fixtures'

const packet: UnencryptedPacket = { origin: ids.initiator, target: ids.responder, data: { ...data, message: { content: 'hello' } } }
const noop = () => void 0

// how: the same encoder serialises frame payloads and the key-schedule info strings; only payloads (JSON objects) are replaced so both sides still derive the same keys.
const payloadEncoder = (bytes: Uint8Array): SessionCrypto => ({
  ...nodeCrypto,
  utf8Encode: (text) => (text.startsWith('{') ? bytes : nodeCrypto.utf8Encode(text)),
})

describe('createSessionProtocol', () => {
  async function pair(senderCrypto: SessionCrypto = nodeCrypto, counterLimit?: number) {
    const { initiator: initiatorSession, responder: responderSession } = sessions('v3')
    const initiator = createSessionProtocol({
      crypto: senderCrypto,
      definition: V3,
      session: initiatorSession,
      send: noop,
      receive: noop,
      logger: createMockLogger(),
      counterLimit,
    })
    const responder = createSessionProtocol({
      crypto: nodeCrypto,
      definition: V3,
      session: responderSession,
      send: noop,
      receive: noop,
      logger: createMockLogger(),
    })
    initiator.acceptHello(await responder.hello())
    responder.acceptHello(await initiator.hello())
    return { initiator, responder }
  }

  it('refuses to seal past the counter limit', async () => {
    const { initiator } = await pair(nodeCrypto, 2)
    await initiator.seal(packet)
    await initiator.seal(packet)
    await expect(initiator.seal(packet)).rejects.toThrow(expect.objectContaining({ code: 'counter-exhausted' }))
  })

  it('exposes the transport callbacks and the logger it was given', async () => {
    const logger = createMockLogger()
    const protocol = createSessionProtocol({
      crypto: nodeCrypto,
      definition: V3,
      session: sessions('v3').initiator,
      send: noop,
      receive: noop,
      logger,
    })
    expect({ send: protocol.send, receive: protocol.receive, logger: protocol.getLogger() }).toEqual({ send: noop, receive: noop, logger })
  })

  it('rejects an authenticated frame that does not carry JSON', async () => {
    const { initiator, responder } = await pair(payloadEncoder(new Uint8Array([0x7b, 0x22])))
    await expect(responder.open(await initiator.seal(packet))).rejects.toThrow(expect.objectContaining({ code: 'malformed' }))
  })

  it('rejects an authenticated frame whose JSON is not a packet', async () => {
    const { initiator, responder } = await pair(payloadEncoder(nodeCrypto.utf8Encode('{"origin":"x"}')))
    await expect(responder.open(await initiator.seal(packet))).rejects.toThrow(expect.objectContaining({ code: 'malformed' }))
  })

  it('rejects an authenticated packet whose envelope is invalid', async () => {
    const forged = nodeCrypto.utf8Encode(`{"origin":"${ids.initiator}","target":"${ids.responder}","data":{"message":"{}"}}`)
    const { initiator, responder } = await pair(payloadEncoder(forged))
    await expect(responder.open(await initiator.seal(packet))).rejects.toThrow('does not carry a valid packet')
  })

  it('does not advance the counter on a rejected frame', async () => {
    const { initiator, responder } = await pair()
    const first = await initiator.seal(packet)
    const second = await initiator.seal(packet)
    second[second.length - 1] ^= 1
    await expect(responder.open(second)).rejects.toThrow()
    await expect(responder.open(first)).resolves.toEqual(packet)
  })
})
