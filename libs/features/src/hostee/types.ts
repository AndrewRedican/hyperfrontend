import type { EventHandler } from '../shared/event-emitter'
import type { RequestHandler, RequestOptions } from '../shared/request'

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
   * Sends a request to the host and resolves with its response.
   *
   * The host answers through a handler it registered with its own
   * `handle(type, handler)`. The promise rejects when the host's handler
   * throws, when the host has no handler for the type, when no response
   * arrives within the timeout (30 seconds by default), when the feature is
   * not connected to a host, or when the host channel closes while the
   * request is pending.
   *
   * @param type - Request action type, drawn from the feature contract.
   * @param data - Optional payload for the request.
   * @param options - Per-request settings such as `timeoutMs`.
   * @returns A promise settling with the host's response payload.
   *
   * @example Asking the host for its settings
   * ```typescript
   * const settings = await feature.request('getSettings', undefined, { timeoutMs: 5000 })
   * ```
   */
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  /**
   * Registers the handler that answers host requests of a given type.
   *
   * One handler per type: registering a second handler for a type that already
   * has one throws. The handler may return the response value directly or a
   * promise of it; a thrown error or rejected promise reaches the host as a
   * failed response carrying the error's message.
   *
   * @param type - Request type to answer.
   * @param handler - Receives the request payload and returns the response.
   * @returns A function that unregisters this handler.
   *
   * @example Answering the host's request for the feature's state
   * ```typescript
   * feature.handle('getTime', (data) => formatTime(data))
   * ```
   */
  handle(type: string, handler: RequestHandler): () => void
  /**
   * Subscribes to host messages or lifecycle events (`open`, `closing`,
   * `close`, `error`).
   *
   * The `closing` event announces a polite teardown while the channel still
   * delivers: handlers may synchronously send final messages (an unsaved
   * draft, a pending write) and they arrive before the close completes.
   *
   * @param event - Message action type or lifecycle event name.
   * @param handler - Callback invoked with the event payload.
   * @returns A function that removes this subscription.
   */
  on(event: string, handler: EventHandler): () => void
  /**
   * Declares whether the feature currently holds unsaved work.
   *
   * The host surfaces this as its `dirty-state` event and `isDirty` flag, so
   * it can take unsaved work into account before starting a polite teardown.
   *
   * @param isDirty - `true` while unsaved work exists; `false` once it is flushed.
   *
   * @example Flagging an unsaved draft
   * ```typescript
   * feature.setDirty(true)
   * saveDraft().then(() => feature.setDirty(false))
   * ```
   */
  setDirty(isDirty: boolean): void
  /**
   * Resolves once the host connection is established.
   *
   * @returns A promise that settles when the channel opens.
   */
  ready(): Promise<void>
  /**
   * Disconnects from the host politely and tears the channel down once the
   * host acknowledges (or the close deadline expires).
   */
  close(): void
}
