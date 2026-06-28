import type { EventHandler } from '../shared/event-emitter'

/**
 * Public handle returned by the hostee-side feature factory.
 */
export interface FeatureHandle {
  /**
   * Sends a typed message to the host.
   *
   * @param type - Action type, drawn from the feature contract.
   * @param data - Optional payload for the action.
   */
  send(type: string, data?: unknown): void
  /**
   * Subscribes to host messages or lifecycle events (`open`, `close`, `error`).
   *
   * @param event - Message action type or lifecycle event name.
   * @param handler - Callback invoked with the event payload.
   * @returns A function that removes this subscription.
   */
  on(event: string, handler: EventHandler): () => void
  /**
   * Resolves once the host connection is established.
   *
   * @returns A promise that settles when the channel opens.
   */
  ready(): Promise<void>
  /**
   * Disconnects from the host and tears the channel down.
   */
  close(): void
}
