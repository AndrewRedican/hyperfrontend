/**
 * Network Protocol V2 - Browser Integration Test
 *
 * Validates that two clients with the same pre-shared key (PSK) can communicate:
 * Client A sends a message → Client B receives and decodes the exact same message.
 *
 * This test simulates a peer-to-peer communication scenario where:
 * 1. Both clients use the same V2 protocol with PSK encryption and obfuscation
 * 2. All messages are encrypted from the start using the shared key
 * 3. The receiving client deobfuscates, deserializes, and decrypts the message
 * 4. Both clients can verify they receive the exact same logical message
 *
 * Note: V2 protocol uses pre-shared key (PSK) encryption where both parties
 * must share the same secret key beforehand (out-of-band key exchange).
 */
import type { TextMessage, ReceivedPacket } from '../model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { sleep } from '@hyperfrontend/time-utils'
import { createClient } from './create-client'

/**
 * Waits for a condition to be true, polling at intervals.
 * More reliable than fixed delays for async operations.
 *
 * @param condition - A function that returns a boolean indicating if the condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 2000ms)
 * @param interval - Time between checks in milliseconds (default: 50ms)
 * @throws {Error} Error if the condition is not met within the timeout
 */
async function waitFor(condition: () => boolean, timeout = 2000, interval = 50): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`)
    }
    await sleep(interval)
  }
}

describe('Network Protocol V2: Connection Established (Browser)', () => {
  describe('Basic Connection with PSK', () => {
    it('establishes connection between two clients with same PSK', () => {
      const clientA = createClient<TextMessage>('client-a')
      const clientB = createClient<TextMessage>('client-b')

      clientA.connect(clientB)

      expect(clientA.getChannel()).toBeDefined()
      expect(clientB.getChannel()).toBeDefined()

      clientA.disconnect()
      clientB.disconnect()
    })

    it('sends message from Client A to Client B using PSK encryption', async () => {
      const clientA = createClient<TextMessage>('client-a')
      const clientB = createClient<TextMessage>('client-b')

      clientA.connect(clientB)

      const receivedMessages: ReceivedPacket<TextMessage>[] = []

      clientB.onMessage((packet) => {
        receivedMessages.push(packet)
      })

      await clientA.send({ type: 'TEXT', content: 'Hello from Client A with PSK!' })

      await waitFor(() => receivedMessages.length >= 1)

      expect(receivedMessages.length).toBe(1)
      expect(receivedMessages[0].origin).toBe(clientA.id)
      expect(receivedMessages[0].target).toBe(clientB.id)
      expect(receivedMessages[0].data.message).toEqual({
        type: 'TEXT',
        content: 'Hello from Client A with PSK!',
      })

      clientA.disconnect()
      clientB.disconnect()
    })

    it('preserves message integrity through PSK encryption/decryption', async () => {
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

      await waitFor(() => receivedPacket !== null)

      expect(receivedPacket).not.toBeNull()
      expect(receivedPacket?.data.message).toEqual(originalMessage)

      clientA.disconnect()
      clientB.disconnect()
    })

    it('allows custom pre-shared keys', async () => {
      const customPSK = 'my-custom-secret-key-for-testing'
      const clientA = createClient<TextMessage>('client-a', customPSK)
      const clientB = createClient<TextMessage>('client-b', customPSK)

      clientA.connect(clientB)

      const receivedMessages: ReceivedPacket<TextMessage>[] = []

      clientB.onMessage((packet) => {
        receivedMessages.push(packet)
      })

      await clientA.send({ type: 'TEXT', content: 'Message with custom PSK' })

      await waitFor(() => receivedMessages.length >= 1)

      expect(receivedMessages.length).toBe(1)
      expect(receivedMessages[0].data.message.content).toBe('Message with custom PSK')

      clientA.disconnect()
      clientB.disconnect()
    })
  })
})
