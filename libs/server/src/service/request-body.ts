import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestBody } from './contract'
import type { Exchange } from './exchange'
import { Readable } from 'node:stream'
import { createTextDecoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isSafeInteger, parseInt, POSITIVE_INFINITY } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseReject } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { httpError } from './http-error'
import { guardStream } from './response-check'

/** What a body needs from its exchange: whether it is over, when it ends, and whether the client waits for `100 Continue`. */
type BodyExchange = Pick<Exchange, 'ended' | 'expectsContinue' | 'onEnd'>

/** One request's body as the readers reach it. */
interface BodySource {
  /** Node's request, which stays paused until a reader listens. */
  readonly req: IncomingMessage
  /** The exchange whose end cuts a read short. */
  readonly exchange: BodyExchange
  /** The declared length, or `null`. */
  readonly length: number | null
  /** Answers `100 Continue` when the client waits for it and no head was written, once the response has its socket. It is called by the one read a body has. */
  begin(): void
}

/** What a reader does with a body while it arrives. */
interface BodyListeners {
  /** Takes one chunk as it was sent. */
  data(chunk: Buffer): void
  /** Runs when the request has been received to its end. */
  end(): void
  /** Runs when the request or its exchange is over before the request's end. */
  gone(): void
}

// note: A length as a request may declare it: decimal digits and nothing else.
const DECIMAL_DIGITS = /^[0-9]+$/

/**
 * Receives the rejection of a read nobody awaited and drops it.
 *
 * @returns Nothing; the handler exists only so that the rejection has one.
 */
const ignoreRejection = (): undefined => undefined

/**
 * Gives a promise a rejection handler of the kernel's own, so a read a handler started and dropped is never an unhandled rejection.
 *
 * @param promise - The promise a reader hands out.
 * @returns The same promise; whoever awaits it still receives the failure.
 */
function handled<Value>(promise: Promise<Value>): Promise<Value> {
  promise.then(undefined, ignoreRejection)
  return promise
}

/**
 * Reports whether a value can cap a buffered read.
 *
 * @param value - The limit a caller gave.
 * @returns `true` for a non-negative safe integer.
 */
function isByteLimit(value: unknown): value is number {
  return isSafeInteger(value) && (value as number) >= 0
}

/**
 * Listens to a request's body, and to the end of its exchange, until told to stop.
 * The exchange must not have ended: its end is the one trigger that always comes, since a request detached from its connection emits nothing.
 *
 * @param source - The body to listen to.
 * @param listeners - How a chunk, the end, and a body cut short are handled.
 * @returns A function that removes every listener and takes the end callback back.
 */
function listen(source: BodySource, listeners: BodyListeners): () => void {
  const { req } = source
  req.on('data', listeners.data)
  req.on('end', listeners.end)
  req.on('error', listeners.gone)
  req.on('close', listeners.gone)
  const forget = source.exchange.onEnd(listeners.gone)
  return () => {
    req.removeListener('data', listeners.data)
    req.removeListener('end', listeners.end)
    req.removeListener('error', listeners.gone)
    req.removeListener('close', listeners.gone)
    forget()
  }
}

/**
 * Buffers a whole body under a cap. A declared length above the cap is refused before a byte is read; a counted
 * overrun stops listening and pauses the request, which is never destroyed, because that would take the socket and the 413 with it.
 *
 * @param source - The body to read.
 * @param limit - The most bytes to accept.
 * @returns A promise for the bytes, rejected with a 413 past the cap and with a 400 when the body is cut short.
 */
function readWhole(source: BodySource, limit: number): Promise<Buffer> {
  return createPromise<Buffer>((resolve, reject) => {
    if (source.exchange.ended) {
      reject(httpError(400, 'body-incomplete'))
      return
    }
    if (source.length !== null && source.length > limit) {
      reject(httpError(413, 'body-too-large'))
      return
    }
    source.begin()
    const chunks: Buffer[] = []
    let seen = 0
    const stop = listen(source, {
      data: (chunk) => {
        seen += chunk.length
        if (seen <= limit) {
          chunks.push(chunk)
          return
        }
        stop()
        source.req.pause()
        reject(httpError(413, 'body-too-large'))
      },
      end: () => {
        stop()
        resolve(Buffer.concat(chunks))
      },
      gone: () => {
        stop()
        reject(httpError(400, 'body-incomplete'))
      },
    })
  })
}

/**
 * Hands a body out as a stream that has already failed, for a read asked for after its exchange ended.
 *
 * @returns A destroyed stream that carries the 400 and the kernel's error listener.
 */
function cutStream(): Readable {
  // note: a destroyed stream is never asked to read, so this one needs no source
  const stream = new Readable()
  guardStream(stream)
  stream.destroy(httpError(400, 'body-incomplete'))
  return stream
}

/**
 * Hands a body out as a stream of the raw chunks, with backpressure: the request is paused while the stream's buffer is full
 * and resumed when it is read. Past the cap the stream is destroyed with a 413, and cut short with a 400; destroying it stops
 * the reading and pauses the request, which is never destroyed.
 *
 * @param source - The body to read.
 * @param limit - The most bytes to let through; `Infinity` for no cap.
 * @returns The stream, which already carries the kernel's error listener.
 */
function streamBody(source: BodySource, limit: number): Readable {
  const { req } = source
  let seen = 0
  const stream = new Readable({
    read: () => void req.resume(),
    destroy: (error, callback) => {
      stop()
      req.pause()
      callback(error)
    },
  })
  const stop = listen(source, {
    data: (chunk) => {
      seen += chunk.length
      if (seen > limit) {
        stream.destroy(httpError(413, 'body-too-large'))
      } else if (!stream.push(chunk)) {
        req.pause()
      }
    },
    end: () => {
      stop()
      stream.push(null)
    },
    gone: () => void stream.destroy(httpError(400, 'body-incomplete')),
  })
  // why: a data listener sets a request flowing, and nothing may flow before the stream is read
  req.pause()
  // why: a stream destroyed with an error while its consumer awaits something else would be an uncaught exception
  guardStream(stream)
  return stream
}

/**
 * Builds the body of one request: nothing is read, and no `100 Continue` is sent, until a reader is called. A response queued behind
 * an earlier one on its connection sends the interim answer when it gets the socket, unless its head was written or its exchange ended first.
 * `bytes()` buffers under a cap and remembers its outcome, `json()` parses those bytes on each call, and `stream()` hands
 * the raw chunks out once, in place of the other two. Every failure a client caused is an `HttpError`, and every promise
 * handed out has a rejection handler of the kernel's own.
 *
 * @param req - Node's request.
 * @param res - Node's response, which answers `100 Continue`.
 * @param exchange - The exchange of the request: its end cuts a read short.
 * @param bodyBytes - The cap of `bytes()` and `json()` when a call gives none.
 * @returns The frozen body a request carries.
 *
 * @example Reading a signed JSON body once for the check and again for the parse
 * ```typescript
 * const body = createRequestBody(req, res, exchange, 65536)
 * const raw = await body.bytes() // the one read, capped at 65536 bytes
 * const document = await body.json() // parsed from the same bytes
 * body.stream(Infinity) // throws: the body was already read
 * ```
 */
export function createRequestBody(req: IncomingMessage, res: ServerResponse, exchange: BodyExchange, bodyBytes: number): RequestBody {
  const declared = req.headers['content-length']
  const length = typeof declared === 'string' && DECIMAL_DIGITS.test(declared) ? parseInt(declared, 10) : null
  let mode: 'unread' | 'buffered' | 'streamed' = 'unread'
  let memo: Promise<Buffer> | null = null

  const source: BodySource = {
    req,
    exchange,
    length,
    begin: () => {
      const answer = (): void => {
        // why: once a head is out, an interim response would land inside the final one
        if (!res.headersSent && !exchange.ended) {
          res.writeContinue()
        }
      }
      if (!exchange.expectsContinue) {
        return
      }
      // why: Node puts the head of a queued response in front of what that response buffered, so an interim line written before the socket would follow the final head
      if (res.socket === null) {
        res.once('socket', answer)
      } else {
        answer()
      }
    },
  }

  const startRead = (limit: number): Promise<Buffer> => {
    const encoding = req.headers['content-encoding']
    // why: decoding here would be a decompression bomb, so an encoded body is refused and stream() yields it as sent
    return encoding !== undefined && encoding.trim().toLowerCase() !== 'identity'
      ? promiseReject(httpError(415, 'unsupported-content-encoding'))
      : readWhole(source, limit)
  }

  const readBytes = async (limit: number = bodyBytes): Promise<Buffer> => {
    if (!isByteLimit(limit)) {
      throw createTypeError('body: the limit must be a non-negative safe integer.')
    }
    if (mode === 'streamed') {
      throw createError('body: the body was already streamed.')
    }
    if (memo === null) {
      mode = 'buffered'
      memo = startRead(limit)
    }
    const buffer = await memo
    if (buffer.length > limit) {
      throw httpError(413, 'body-too-large')
    }
    return buffer
  }

  const readJson = async (limit: number | undefined): Promise<unknown> => {
    const mediaType = ((req.headers['content-type'] ?? '').split(';')[0] as string).trim().toLowerCase()
    if (mediaType !== 'application/json') {
      throw httpError(415, 'unsupported-media-type')
    }
    const bytes = await readBytes(limit)
    try {
      return parse(createTextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      // why: the parser's message echoes the input, so it is dropped
      throw httpError(400, 'malformed-body')
    }
  }

  return freeze({
    length,
    bytes: (limitBytes?: number) => handled(readBytes(limitBytes)),
    json: (limitBytes?: number) => handled(readJson(limitBytes)),
    stream: (limitBytes: number): Readable => {
      if (limitBytes !== POSITIVE_INFINITY && !isByteLimit(limitBytes)) {
        throw createTypeError('body: the limit must be a non-negative safe integer or Infinity.')
      }
      if (mode !== 'unread') {
        throw createError('body: the body was already read.')
      }
      mode = 'streamed'
      if (exchange.ended) {
        return cutStream()
      }
      if (length !== null && length > limitBytes) {
        throw httpError(413, 'body-too-large')
      }
      source.begin()
      return streamBody(source, limitBytes)
    },
  })
}
