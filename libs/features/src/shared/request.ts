import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ControlType } from './control'

// note: Correlated request/response envelopes ride the reserved control plane, so consumers get promise-based queries without hand-rolling reply actions, correlation ids, or timeouts.

// magic: 30s default — generous enough for handler work on the other side while still surfacing a hung counterpart.
const DEFAULT_TIMEOUT_MS = 30000

/**
 * Which side of the feature channel a peer speaks for.
 */
export type PeerOrigin = 'host' | 'feature'

/**
 * Per-request settings accepted by `request`.
 */
export interface RequestOptions {
  /** Milliseconds to wait for the response before rejecting; defaults to 30000. */
  timeoutMs?: number
}

/**
 * Answers one request type; may return the response value directly or a promise of it.
 *
 * @param data - The request payload sent by the other side.
 * @returns The response value, or a promise that resolves to it.
 */
export type RequestHandler = (data: unknown) => unknown

/**
 * One side of the correlated request/response protocol layered on the control plane.
 */
export interface RequestPeer {
  /**
   * Sends a request to the other side and resolves with its response.
   *
   * @param type - Request type the other side answers.
   * @param data - Optional payload for the request.
   * @param options - Per-request settings such as `timeoutMs`.
   * @returns A promise settling with the other side's response.
   */
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  /**
   * Registers the single handler answering requests of a type; a second registration for the same type throws.
   *
   * @param type - Request type to answer.
   * @param handler - Receives the request payload and returns the response.
   * @returns A function that unregisters this handler.
   */
  handle(type: string, handler: RequestHandler): () => void
  /**
   * Routes an incoming control-plane message into the protocol; non-envelope data and self-originated echoes are ignored.
   *
   * @param type - The wire message type.
   * @param data - The wire message payload.
   */
  dispatch(type: string, data: unknown): void
  /**
   * Rejects every pending request, e.g. when the channel closes.
   *
   * @param reason - Human-readable reason placed on each rejection error.
   */
  rejectAll(reason: string): void
}

/**
 * Wire shape carried inside request and response control messages.
 */
interface Envelope {
  /** Pairs a response with the request that caused it. */
  correlationId: string
  /** The side that sent this envelope. */
  from: PeerOrigin
  /** The consumer-facing request type the envelope carries. */
  innerType: string
  /** Request payload, or response value on an ok response. */
  payload?: unknown
  /** Response outcome: `true` resolves the requester, `false` rejects it. */
  ok?: boolean
  /** Failure message on a non-ok response. */
  error?: string
}

/**
 * Outcome half of a response envelope, merged over the request's correlation fields.
 */
interface ResponseOutcome {
  /** `true` resolves the requester, `false` rejects it. */
  ok: boolean
  /** Response value on an ok outcome. */
  payload?: unknown
  /** Failure message on a non-ok outcome. */
  error?: string
}

/**
 * A request awaiting its response.
 */
interface PendingRequest {
  /** Resolves the requester's promise with the response payload. */
  resolve(value: unknown): void
  /** Rejects the requester's promise. */
  reject(reason: unknown): void
  /** Timeout timer released when the request settles. */
  timer: ReturnType<typeof setTimeout>
}

/**
 * Creates one side of the request/response protocol around a channel send function.
 *
 * @param origin - Which side of the channel this peer speaks for.
 * @param send - Sends a control message through the underlying channel.
 * @returns The frozen peer.
 *
 * @example Wiring a peer into a channel's control-message intercept
 * ```typescript
 * const peer = createRequestPeer('host', (type, data) => channel?.send(type, data))
 * channel.onMessage((message) => isControlType(message.type) && peer.dispatch(message.type, message.data))
 * ```
 */
export function createRequestPeer(origin: PeerOrigin, send: (type: string, data: unknown) => void): RequestPeer {
  let pending: Record<string, PendingRequest> = {}
  const handlers: Record<string, RequestHandler> = {}
  let nextCorrelation = 0

  const take = (correlationId: string): PendingRequest | undefined => {
    const entry = pending[correlationId]
    if (entry) {
      clearTimeout(entry.timer)
      delete pending[correlationId]
    }
    return entry
  }

  const respond = (request: Envelope, outcome: ResponseOutcome) =>
    send(ControlType.Response, <Envelope>{ correlationId: request.correlationId, from: origin, innerType: request.innerType, ...outcome })

  const answer = (request: Envelope) => {
    const handler = handlers[request.innerType]
    if (!handler) {
      respond(request, { ok: false, error: `No handler is registered for '${request.innerType}'.` })
      return
    }
    promiseResolve()
      .then(() => handler(request.payload))
      .then(
        (payload) => respond(request, { ok: true, payload }),
        (error) => respond(request, { ok: false, error: error instanceof Error ? error.message : `${error}` })
      )
  }

  const settle = (response: Envelope) => {
    const entry = take(response.correlationId)
    if (!entry) {
      return
    }
    if (response.ok) {
      entry.resolve(response.payload)
      return
    }
    entry.reject(createError(response.error ?? `Request '${response.innerType}' failed.`))
  }

  const dispatch = (type: string, data: unknown) => {
    const envelope = <Envelope | null>(typeof data === 'object' ? data : null)
    // why: The channel echoes each side's outbound messages back to its own subscribers, so a peer must discard envelopes stamped with its own origin or it would answer its own requests.
    if (!envelope || envelope.from === origin) {
      return
    }
    if (type === ControlType.Request) {
      answer(envelope)
      return
    }
    if (type === ControlType.Response) {
      settle(envelope)
    }
  }

  const request = (type: string, data?: unknown, options?: RequestOptions) =>
    createPromise<unknown>((resolve, reject) => {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
      const correlationId = `${origin}-${(nextCorrelation += 1)}`
      const timer = setTimeout(() => {
        delete pending[correlationId]
        reject(createError(`Request '${type}' timed out after ${timeoutMs}ms.`))
      }, timeoutMs)
      pending[correlationId] = { resolve, reject, timer }
      send(ControlType.Request, <Envelope>{ correlationId, from: origin, innerType: type, payload: data })
    })

  const handle = (type: string, handler: RequestHandler) => {
    if (handlers[type]) {
      throw createError(`A handler for '${type}' is already registered.`)
    }
    handlers[type] = handler
    return () => {
      if (handlers[type] === handler) {
        delete handlers[type]
      }
    }
  }

  const rejectAll = (reason: string) => {
    const failed = values(pending)
    pending = {}
    for (const entry of failed) {
      clearTimeout(entry.timer)
      entry.reject(createError(reason))
    }
  }

  return freeze(<RequestPeer>{ request, handle, dispatch, rejectAll })
}
