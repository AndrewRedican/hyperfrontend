import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Single subscription registry powering both the host shell and hostee feature on(event, handler) surfaces, keeping their event vocabulary identical.

/**
 * Handler invoked when a subscribed event fires.
 *
 * @param data - Event payload, or `undefined` for payload-less events.
 */
export type EventHandler = (data: unknown) => void

/**
 * A minimal string-keyed event emitter returning unsubscribe functions.
 */
export interface EventEmitter {
  /**
   * Subscribes to an event.
   *
   * @param event - Event name to listen for.
   * @param handler - Callback invoked with the event payload.
   * @returns A function that removes this subscription.
   */
  on(event: string, handler: EventHandler): () => void
  /**
   * Emits an event to all current subscribers.
   *
   * @param event - Event name to dispatch.
   * @param data - Optional payload passed to each handler.
   */
  emit(event: string, data?: unknown): void
}

/**
 * Creates an {@link EventEmitter} backed by a plain registry.
 *
 * @returns A frozen emitter instance.
 *
 * @example Subscribing and emitting
 * ```typescript
 * const emitter = createEventEmitter()
 * const off = emitter.on('open', () => console.log('opened'))
 * emitter.emit('open')
 * off()
 * ```
 */
export function createEventEmitter(): EventEmitter {
  const registry: Record<string, EventHandler[]> = {}

  const on = (event: string, handler: EventHandler): (() => void) => {
    const handlers = registry[event] ?? (registry[event] = [])
    handlers.push(handler)
    return () => {
      registry[event] = handlers.filter((current) => current !== handler)
    }
  }

  const emit = (event: string, data?: unknown): void => {
    registry[event]?.forEach((handler) => handler(data))
  }

  return freeze({ on, emit } as EventEmitter)
}
