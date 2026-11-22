import type { ServiceClock } from './clock'
import type { ServiceResponse } from './contract'
import type { Exchange } from './exchange'
import { Readable } from 'node:stream'
import { createError, createRangeError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { httpError, renderFailure } from './http-error'
import { guardStream, isStale, releaseBody } from './response-check'

/** The bound a response write is held to. */
export interface WriteLimits {
  /** How long one wait for the client to take bytes may last before the connection is cut, in milliseconds. */
  readonly writeIdleTimeoutMs: number
}

/** One response on its way out, as the functions of this module hand it to each other. */
interface Writing {
  /** The exchange the response answers. */
  readonly exchange: Exchange
  /** The bound of each wait. */
  readonly limits: WriteLimits
  /** The clock the waits are timed on. */
  readonly clock: ServiceClock
  /** Whether the shutdown of the service closes the connection after this response, asked at the moment a head is written. */
  readonly closing: () => boolean
  /** Whether a head has been written, after which no other status can be sent. */
  headSent: boolean
}

/** Why a stream body could not be written to its end. */
interface StreamFailure {
  /** What the stream failed with; only its name reaches an event. */
  readonly error: unknown
}

// note: The largest single write of a buffer body, so a wait for the client covers at most this many bytes.
const SLICE_BYTES = 65536

/**
 * Finds the length a response declares.
 *
 * @param headers - The headers of the response.
 * @returns The value of the `Content-Length` header in whatever spelling it has, or `null`.
 */
function declaredLength(headers: Readonly<Record<string, string>>): string | null {
  const name = keys(headers).find((key) => key.toLowerCase() === 'content-length')
  return name === undefined ? null : (headers[name] as string)
}

/**
 * Writes the head: the headers as they are spelled, in their order, then the cookies, the length and, when the
 * connection will not be kept, `Connection: close`.
 *
 * @param writing - The response on its way out.
 * @param response - The response whose status and headers are written.
 * @param length - The `Content-Length` to send, or `null` for none.
 */
function writeHead(writing: Writing, response: ServiceResponse, length: string | null): void {
  const { req, res } = writing.exchange
  const cookies: string[] = []
  for (const name of keys(response.headers)) {
    const lower = name.toLowerCase()
    if (lower === 'set-cookie') {
      cookies.push(response.headers[name] as string)
    } else if (lower !== 'content-length') {
      res.setHeader(name, response.headers[name] as string)
    }
  }
  cookies.push(...(response.cookies ?? []))
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies)
  }
  if (length !== null) {
    res.setHeader('Content-Length', length)
  }
  // why: a connection whose request is still arriving cannot carry another exchange, and a draining service keeps none past its last exchange in flight
  if (writing.closing() || !req.complete) {
    res.setHeader('Connection', 'close')
  }
  res.writeHead(response.status)
  writing.headSent = true
  writing.exchange.noteStatus(response.status)
}

/**
 * Waits for the response to drain or to finish. The wait is bounded on the injected clock and is also ended by the end
 * of the exchange. When the bound passes on a response that held its socket throughout, the client has stopped taking bytes:
 * the outcome is `write-stalled` and the socket is destroyed. While the response is queued behind an earlier one, the bound starts again.
 * So a wait that ends without its event leaves the exchange with an outcome, and that is how its callers tell the two apart.
 *
 * @param writing - The response on its way out.
 * @param event - The event of the response that ends the wait.
 * @returns A promise that resolves when the wait is over: the event arrived, the bound passed, or the exchange ended.
 */
function waitFor(writing: Writing, event: 'drain' | 'finish'): Promise<void> {
  const { exchange, clock, limits } = writing
  const { res } = exchange
  return createPromise<void>((resolve) => {
    let timer: unknown
    let owned = false
    const arm = (): void => {
      owned = res.socket !== null
      timer = clock.setTimeout(onStall, limits.writeIdleTimeoutMs)
    }
    const over = (): void => {
      clock.clearTimeout(timer)
      res.removeListener(event, onEvent)
      resolve()
    }
    const onEvent = (): void => {
      forget()
      over()
    }
    const onStall = (): void => {
      // why: a queued response waits for the server's own earlier handler, and cutting it would destroy the socket under that response; only a client that had the socket for the whole period has stalled
      if (res.socket === null || !owned) {
        arm()
        return
      }
      exchange.settleOutcome('write-stalled')
      exchange.socket.destroy()
      forget()
      over()
    }
    arm()
    res.on(event, onEvent)
    const forget = exchange.onEnd(over)
  })
}

/**
 * Waits for the response to drain after a write it did not take.
 *
 * @param writing - The response on its way out.
 * @returns A promise for `true` when the next write may go out, and for `false` when the write is over.
 */
async function drained(writing: Writing): Promise<boolean> {
  await waitFor(writing, 'drain')
  // why: the exchange can also get its outcome between the drain and this continuation, and nothing is written after that
  return writing.exchange.outcome === null
}

/**
 * Waits for the response to be flushed after its end, and settles the outcome as `sent` when it was.
 *
 * @param writing - The response on its way out.
 */
async function flushed(writing: Writing): Promise<void> {
  await waitFor(writing, 'finish')
  // note: a wait that ended without its finish left an outcome behind, and the first cause wins
  writing.exchange.settleOutcome('sent')
}

/**
 * Takes a stream's chunks and writes them, the head with the first one, pausing the stream while the response does not drain.
 * It stops at the stream's end, at its failure, and when the exchange has an outcome.
 *
 * @param writing - The response on its way out.
 * @param response - The response, for the head.
 * @param body - The stream to write.
 * @param declared - The length the response declares, which the stream must then match exactly, or `null`.
 * @returns A promise for the stream's failure, or for `null` when the stream ended as declared or the exchange has an outcome. It rejects when a write throws.
 */
function pump(writing: Writing, response: ServiceResponse, body: Readable, declared: string | null): Promise<StreamFailure | null> {
  const { exchange } = writing
  const limit = declared === null ? null : parseInt(declared, 10)
  return createPromise<StreamFailure | null>((resolve, reject) => {
    let sent = 0
    const stop = (): void => {
      body.removeListener('data', onData)
      body.removeListener('end', onEnd)
      body.removeListener('error', fail)
      body.removeListener('close', onClose)
    }
    const settle = (failure: StreamFailure | null): void => {
      stop()
      forget()
      resolve(failure)
    }
    const fail = (error: unknown): void => settle({ error })
    const onEnd = (): void =>
      settle(limit !== null && sent !== limit ? { error: createRangeError('the stream ended short of its declared length') } : null)
    const onClose = (): void => fail(createError('the stream closed before its end'))
    const write = (bytes: Uint8Array): boolean => {
      if (!writing.headSent) {
        writeHead(writing, response, declared)
      }
      sent += bytes.length
      return exchange.res.write(bytes)
    }
    const onData = (chunk: unknown): void => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      if (exchange.outcome !== null) {
        settle(null)
      } else if (!(bytes instanceof Uint8Array)) {
        fail(createTypeError('a stream chunk must be bytes or a string'))
      } else if (limit !== null && sent + bytes.length > limit) {
        fail(createRangeError('the stream passed its declared length'))
      } else if (bytes.length > 0) {
        try {
          if (write(bytes)) {
            return
          }
        } catch (error) {
          stop()
          forget()
          reject(error)
          return
        }
        body.pause()
        void drained(writing).then((open) => (open ? void body.resume() : settle(null)))
      }
    }
    body.on('data', onData)
    body.on('end', onEnd)
    body.on('error', fail)
    body.on('close', onClose)
    // why: a stream its handler paused would otherwise never yield the chunk the head waits for
    body.resume()
    const forget = exchange.onEnd(() => {
      stop()
      resolve(null)
    })
  })
}

/**
 * Writes a response whose body is a stream. A stream that fails before its first byte is answered by the plain 500;
 * one that fails later leaves the client a cut transfer, never one that looks complete.
 *
 * @param writing - The response on its way out.
 * @param response - The response to write.
 * @param body - Its stream body.
 * @param declared - The length the response declares, or `null`.
 */
async function sendStream(writing: Writing, response: ServiceResponse, body: Readable, declared: string | null): Promise<void> {
  const { exchange } = writing
  // why: between the moment the pump lets go of a failed stream and its release, an error of the stream would have no listener
  guardStream(body)
  // why: a stale stream never emits the chunk or the end a pump would wait for
  const failure = isStale(body)
    ? { error: body.errored ?? createError('the stream body was already used') }
    : await pump(writing, response, body, declared)
  if (exchange.outcome !== null) {
    releaseBody(body)
    return
  }
  if (failure === null) {
    if (!writing.headSent) {
      writeHead(writing, response, declared)
    }
    exchange.res.end()
    await flushed(writing)
    return
  }
  releaseBody(body)
  exchange.failure('stream-failed', failure.error)
  if (writing.headSent) {
    exchange.settleOutcome('write-failed')
    exchange.socket.destroy()
    return
  }
  exchange.context.annotate('failure', 'internal')
  await send(writing, renderFailure(httpError(500, 'internal')))
}

/**
 * Writes one response: its head, then its body in the way its kind asks for, then waits for it to be flushed.
 *
 * @param writing - The response on its way out.
 * @param response - The response to write, which has passed the response check.
 */
async function send(writing: Writing, response: ServiceResponse): Promise<void> {
  const { req, res } = writing.exchange
  const { status, body } = response
  const declared = declaredLength(response.headers)
  const head = req.method === 'HEAD'
  if (head || status === 204 || status === 304 || body === null) {
    releaseBody(body)
    const kept = head || status === 304 ? declared : '0'
    writeHead(writing, response, status === 204 ? null : Buffer.isBuffer(body) ? `${body.length}` : kept)
    res.end()
    await flushed(writing)
    return
  }
  if (body instanceof Readable) {
    await sendStream(writing, response, body, declared)
    return
  }
  writeHead(writing, response, `${body.length}`)
  let offset = 0
  while (body.length - offset > SLICE_BYTES) {
    const taken = res.write(body.subarray(offset, offset + SLICE_BYTES))
    offset += SLICE_BYTES
    if (!taken && !(await drained(writing))) {
      return
    }
  }
  res.end(body.subarray(offset))
  await flushed(writing)
}

/**
 * Answers for a response that could not be written: the plain 500 when no head went out, tried once, and otherwise,
 * or when that throws as well, a destroyed socket and the outcome `write-failed`.
 *
 * @param writing - The response that failed.
 */
async function lastResort(writing: Writing): Promise<void> {
  const { exchange } = writing
  if (!writing.headSent) {
    try {
      // why: what was set for the response that failed must not go out on the 500
      exchange.res.getHeaderNames().forEach((name) => exchange.res.removeHeader(name))
      exchange.context.annotate('failure', 'internal')
      await send(writing, renderFailure(httpError(500, 'internal')))
      return
    } catch {
      // why: a response that cannot carry even the plain 500 is given up on, and its connection with it
    }
  }
  exchange.settleOutcome('write-failed')
  exchange.socket.destroy()
}

/**
 * Writes the response of an exchange, once, and resolves when nothing more will be written: the response was flushed,
 * the client stopped taking bytes, the exchange ended, or the write failed. It never rejects.
 *
 * A response that arrives after the exchange got its outcome is released and nothing is written. A buffer goes out in slices;
 * a stream goes out chunk by chunk with its head held back until the first one; a `HEAD` request, a 204 and a 304 get no body bytes.
 * Every wait for the client is bounded by `writeIdleTimeoutMs`, and a stream that is not written to its end is destroyed.
 *
 * @param exchange - The exchange the response answers.
 * @param response - What the outermost boundary resolved with, so a value that has passed the response check.
 * @param limits - The bound of each wait for the client.
 * @param clock - The clock the waits are timed on.
 * @param closing - Whether the shutdown of the service closes the connection after this response, read when a head is written.
 * @returns A promise that resolves when the write is over, whatever its outcome.
 *
 * @example Writing what the pipeline answered, at least one microtask after the request event
 * ```typescript
 * const exchange = createExchange(req, res, options, clock, emit, false)
 * const response = await settle(() => runPipeline(steps, exchange.request, exchange.context), exchange.context)
 * await writeResponse(exchange, response, { writeIdleTimeoutMs: 30000 }, clock, () => false)
 * exchange.outcome // 'sent' once the response was flushed
 * ```
 */
export async function writeResponse(
  exchange: Exchange,
  response: ServiceResponse,
  limits: WriteLimits,
  clock: ServiceClock,
  closing: () => boolean
): Promise<void> {
  if (exchange.outcome !== null) {
    releaseBody(response)
    return
  }
  const writing: Writing = { exchange, limits, clock, closing, headSent: false }
  try {
    await send(writing, response)
  } catch (error) {
    releaseBody(response)
    // why: the first cause wins, so a throw that follows an outcome is neither reported nor answered
    if (exchange.outcome === null) {
      exchange.failure('write-failed', error)
      await lastResort(writing)
    }
  }
}
