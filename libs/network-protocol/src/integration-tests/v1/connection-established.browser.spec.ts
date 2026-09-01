/**
 * Network Protocol V1 - Browser Integration Test
 *
 * Validates that two clients with the same protocol configuration can communicate:
 * Client A sends a message → Client B receives and decodes the exact same message.
 *
 * This test simulates a peer-to-peer communication scenario where:
 * 1. Both clients use the same V1 protocol with encryption and obfuscation
 * 2. Messages are encrypted, serialized, and obfuscated before transmission
 * 3. The receiving client deobfuscates, deserializes, and decrypts the message
 * 4. Both clients can verify they receive the exact same logical message
 *
 * Note: V1 protocol uses dynamic key exchange where the first message contains
 * the encryption key for subsequent communications.
 */
import type { TextMessage, ReceivedPacket } from '../model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { createClient } from './create-client'

describe('Network Protocol V1: Connection Established (Browser)', () => {
  const PROCESSING_DELAY = 350

  describe('Basic Connection', () => {
    it('establishes connection between two clients', () => {
      const clientA = createClient<TextMessage>('client-a')
      const clientB = createClient<TextMessage>('client-b')

      clientA.connect(clientB)

      expect(clientA.getChannel()).toBeDefined()
      expect(clientB.getChannel()).toBeDefined()

      clientA.disconnect()
      clientB.disconnect()
    })

    it('sends message from Client A to Client B', async () => {
      const clientA = createClient<TextMessage>('client-a')
      const clientB = createClient<TextMessage>('client-b')

      clientA.connect(clientB)

      const receivedMessages: ReceivedPacket<TextMessage>[] = []

      clientB.onMessage((packet) => {
        receivedMessages.push(packet)
      })

      await clientA.send({ type: 'TEXT', content: 'Hello from Client A!' })

      await sleep(PROCESSING_DELAY)

      expect(receivedMessages.length).toBe(1)
      expect(receivedMessages[0].origin).toBe(clientA.id)
      expect(receivedMessages[0].target).toBe(clientB.id)
      expect(receivedMessages[0].data.message).toEqual({
        type: 'TEXT',
        content: 'Hello from Client A!',
      })

      clientA.disconnect()
      clientB.disconnect()
    })

    it('preserves message integrity through encryption/decryption', async () => {
      const clientA = createClient<TextMessage>('client-a')
      const clientB = createClient<TextMessage>('client-b')

      clientA.connect(clientB)

      const originalMessage: TextMessage = {
        type: 'TEXT',
        content: 'This is a test message with special chars: @#$%^&*()!',
      }

      let receivedPacket: ReceivedPacket<TextMessage> | null = null

      clientB.onMessage((packet) => {
        receivedPacket = packet
      })

      await clientA.send(originalMessage)
      await sleep(PROCESSING_DELAY)

      expect(receivedPacket).not.toBeNull()
      expect(receivedPacket?.data.message).toEqual(originalMessage)

      clientA.disconnect()
      clientB.disconnect()
    })
  })
})
