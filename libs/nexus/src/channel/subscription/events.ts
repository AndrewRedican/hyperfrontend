import type { EventHandler } from '../../types/channel'
import type { ChannelEvent, EventCallbackMap } from '../../types/events'
import type { ChannelInternals } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Subscribes to channel lifecycle events.
 *
 * Events include: 'open', 'close', 'cancel', 'deny', 'invalid', 'destroy',
 * 'security-negotiated', 'security-ready', 'security-error'
 *
 * @param channel - Channel internals with state and dependencies
 * @param handler - Event handler function
 * @returns Unsubscribe function to remove the handler
 *
 * @throws {Error} If handler is not a function
 *
 * @example Generic event handler
 * ```typescript
 * const unsubscribe = subscribeToEvents(channel, (event, data) => {
 *   console.log('Event:', event, data)
 * })
 * ```
 *
 * @example Event-specific handler
 * ```typescript
 * const unsubscribe = subscribeToEvents(channel, 'open', (data) => {
 *   console.log('Opened:', data.origin)
 * })
 * ```
 */
export function subscribeToEvents(channel: ChannelInternals, handler: EventHandler): () => void
export function subscribeToEvents<E extends ChannelEvent>(channel: ChannelInternals, event: E, handler: EventCallbackMap[E]): () => void
/**
 * Implementation of subscribeToEvents that handles both overload signatures.
 *
 * @param channel - The channel internals object
 * @param eventOrHandler - Either an event name or a handler function
 * @param handler - Handler function when event name is provided
 * @returns Unsubscribe function to remove the handler
 *
 * @example Subscribing to all events with cleanup
 * ```typescript
 * const unsubscribe = subscribeToEvents(channel, (event, data) => {
 *   if (event === 'open') {
 *     console.log('Channel opened:', data)
 *   }
 * })
 *
 * // Cleanup when no longer needed
 * unsubscribe()
 * ```
 */
export function subscribeToEvents<E extends ChannelEvent>(
  channel: ChannelInternals,
  eventOrHandler: E | EventHandler,
  handler?: EventCallbackMap[E]
): () => void {
  const isEventSpecific = typeof eventOrHandler === 'string' && typeof handler === 'function'

  let wrappedHandler: EventHandler

  if (isEventSpecific) {
    const eventType = <E>eventOrHandler
    const callback = <EventCallbackMap[E]>handler

    wrappedHandler = (event, data, channelJSON) => {
      if (event === eventType) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(<any>callback)(data, channelJSON)
      }
    }
  } else if (typeof eventOrHandler === 'function') {
    wrappedHandler = eventOrHandler
  } else {
    throw createError('Expected callback function.')
  }

  if (typeof wrappedHandler !== 'function') {
    throw createError('Expected callback function.')
  }

  const state = channel.getState()

  const subscriptions = [...state.eventSubscriptions, wrappedHandler]
  channel.updateState({ eventSubscriptions: subscriptions })

  return () => {
    const currentState = channel.getState()
    const filtered = currentState.eventSubscriptions.filter((h) => h !== wrappedHandler)
    channel.updateState({ eventSubscriptions: filtered })
  }
}
