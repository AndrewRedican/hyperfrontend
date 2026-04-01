import type { MessageHandler } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Subscribes to incoming messages on the channel.
 *
 * Handler will be called with each message received from the target window.
 *
 * @param channel - Channel internals with state and dependencies
 * @param handler - Message handler function
 * @returns Unsubscribe function to remove the handler
 *
 * @throws {Error} If handler is not a function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToMessages(channel, (message) => {
 *   console.log('Message:', message.type, message.data)
 * })
 *
 * // Later: unsubscribe()
 * ```
 */
export function subscribeToMessages(channel: ChannelInternals, handler: MessageHandler): () => void {
  if (typeof handler !== 'function') {
    throw createError('Expected callback function.')
  }

  const state = channel.getState()

  const subscriptions = [...state.messageSubscriptions, handler]
  channel.updateState({ messageSubscriptions: subscriptions })

  return () => {
    const currentState = channel.getState()
    const filtered = currentState.messageSubscriptions.filter((h) => h !== handler)
    channel.updateState({ messageSubscriptions: filtered })
  }
}
