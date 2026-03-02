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
 * @example Generic handler
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
export function subscribeToEvents<E extends ChannelEvent>(
  channel: ChannelInternals,
  eventOrHandler: E | EventHandler,
  handler?: EventCallbackMap[E]
): () => void {
  // Determine if this is the event-specific overload
  const isEventSpecific = typeof eventOrHandler === 'string' && typeof handler === 'function'

  let wrappedHandler: EventHandler

  if (isEventSpecific) {
    const eventType = <E>eventOrHandler
    const callback = <EventCallbackMap[E]>handler

    // Wrap the event-specific callback as a generic EventHandler
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

  // Add handler to subscriptions
  const subscriptions = [...state.eventSubscriptions, wrappedHandler]
  channel.updateState({ eventSubscriptions: subscriptions })

  // Return unsubscribe function
  return () => {
    const currentState = channel.getState()
    const filtered = currentState.eventSubscriptions.filter((h) => h !== wrappedHandler)
    channel.updateState({ eventSubscriptions: filtered })
  }
}
