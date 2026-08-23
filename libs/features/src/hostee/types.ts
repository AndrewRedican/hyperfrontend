import type { EventHandler } from '../shared/event-emitter'
import type { RequestHandler, RequestOptions } from '../shared/request'
import type { DisplayMode } from '../shared/types'

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
   * `close`, `error`, `presentation`, `resize`).
   *
   * The `closing` event announces a polite teardown while the channel still
   * delivers: handlers may synchronously send final messages (an unsaved
   * draft, a pending write) and they arrive before the close completes.
   * `presentation` fires once with `{ mode }` when the host announces how the
   * feature is surfaced. `resize` fires with the available `{ width, height }`
   * in exact pixels: host-reported in the iframe modes, from the feature's
   * own window in the windowed modes; the feature author owns making the
   * layout respond to it.
   *
   * @param event - Message action type or lifecycle event name.
   * @param handler - Callback invoked with the event payload.
   * @returns A function that removes this subscription.
   */
  on(event: string, handler: EventHandler): () => void
  /**
   * Whether a host window exists for this feature at all: `true` when the
   * document has a parent window (an embedding iframe) or an opener, `false`
   * on a direct top-level visit. Known synchronously by the time `createFeature`
   * returns and never changes; it does not promise the host will speak, since
   * connection state stays with `ready()` and the lifecycle events. Where
   * `displayMode` answers how the host mounted the feature, `hosted` answers
   * whether a host exists: unhosted, `displayMode` stays `null` and `ready()`
   * stays pending.
   */
  readonly hosted: boolean
  /**
   * The display mode the host announced for this mount, or `null` before the
   * announcement arrives (it is the first message after `open`) and after the
   * channel closes.
   */
  readonly displayMode: DisplayMode | null
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
