import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Readable } from 'node:stream'
import type { RequestBody } from './contract'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { describe, expect, it, waitUntil } from '@hyperfrontend/testing'
import { createRequestBody } from './request-body'

/** One fake body and everything around it a spec drives or reads. */
interface Harness {
  /** The body under test. */
  readonly body: RequestBody
  /** The fake request stream. */
  readonly req: PassThrough
  /** Ends the fake exchange. */
  end(): void
  /** How many callbacks wait for the end of the fake exchange. */
  waiting(): number
}

const LISTENED = ['data', 'end', 'error', 'close'] as const
const QUICK = { interval: 1 }
const UNCAPPED = Number.POSITIVE_INFINITY
const TOO_LARGE = { name: 'HttpError', message: 'body-too-large', status: 413 }
const INCOMPLETE = { name: 'HttpError', message: 'body-incomplete', status: 400 }

/**
 * Builds a body over a fake request, response and exchange.
 *
 * @param headers - The request headers, lower-cased.
 * @returns The body and its surroundings.
 */
const build = (headers: IncomingHttpHeaders = {}): Harness => {
  const req = Object.assign(new PassThrough(), { headers })
  const callbacks = new Set<() => void>()
  const state = { ended: false }
  const exchange = {
    expectsContinue: false,
    get ended(): boolean {
      return state.ended
    },
    onEnd: (callback: () => void): (() => void) => {
      callbacks.add(callback)
      return () => void callbacks.delete(callback)
    },
  }
  return {
    body: createRequestBody(req as unknown as IncomingMessage, { headersSent: false } as unknown as ServerResponse, exchange, 65536),
    req,
    end: () => {
      state.ended = true
      for (const callback of [...callbacks]) callback()
    },
    waiting: () => callbacks.size,
  }
}

/**
 * Describes what a call throws.
 *
 * @param run - The call.
 * @returns What the thrown error carries, or `null` when nothing was thrown.
 */
const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
    return null
  } catch (error) {
    const { name, message, status } = error as Error & { status?: number }
    return { name, message, status }
  }
}

/**
 * Reads a stream to its end.
 *
 * @param stream - The stream a body handed out.
 * @returns The text read, or what the stream failed with.
 */
const drained = async (stream: Readable): Promise<unknown> => {
  const chunks: Buffer[] = []
  try {
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString()
  } catch (error) {
    const { name, message, status } = error as Error & { status?: number }
    return { name, message, status }
  }
}

/**
 * Counts the listeners a reader may have left on the request.
 *
 * @param req - The fake request.
 * @returns The count per event the readers listen for.
 */
const listeners = (req: PassThrough): number[] => LISTENED.map((event) => req.listenerCount(event))

/**
 * Describes the failure a stream was destroyed with.
 *
 * @param stream - The stream a body handed out.
 * @returns What the error carries, or `null` while the stream has not failed.
 */
const failureOf = (stream: Readable): unknown => {
  const error = stream.errored as (Error & { status?: number }) | null
  return error === null ? null : { name: error.name, message: error.message, status: error.status }
}

describe('createRequestBody stream', () => {
  it('yields the chunks as they were sent', async () => {
    const { body, req } = build()
    const read = drained(body.stream(UNCAPPED))
    req.write('ab')
    req.write('cd')
    req.end('ef')
    expect(await read).toBe('abcdef')
  })

  it('yields the bytes of an encoded body as sent, without judging the encoding', async () => {
    const { body, req } = build({ 'content-encoding': 'gzip' })
    req.end('still-compressed')
    expect(await drained(body.stream(UNCAPPED))).toBe('still-compressed')
  })

  it('ends when the request ends', async () => {
    const { body, req } = build()
    const stream = body.stream(UNCAPPED)
    req.end()
    await drained(stream)
    expect(stream.readableEnded).toBe(true)
  })

  it('stops listening and waiting once the request has ended', async () => {
    const { body, req, waiting } = build()
    const stream = body.stream(UNCAPPED)
    req.end('done')
    await drained(stream)
    expect({ listeners: listeners(req), waiting: waiting() }).toEqual({ listeners: [0, 0, 0, 0], waiting: 0 })
  })

  it('keeps the request paused until the stream is read', () => {
    const { body, req } = build()
    body.stream(UNCAPPED)
    req.write('early')
    expect(req.isPaused()).toBe(true)
  })

  it('pauses the request when its own buffer is full', async () => {
    const { body, req } = build()
    const stream = body.stream(UNCAPPED)
    stream.read(0)
    req.write(Buffer.alloc(200_000))
    await waitUntil(() => stream.readableLength === 200_000, QUICK)
    expect(req.isPaused()).toBe(true)
  })

  it('resumes the request when its buffer is read', async () => {
    const { body, req } = build()
    const stream = body.stream(UNCAPPED)
    stream.read(0)
    req.write(Buffer.alloc(200_000))
    await waitUntil(() => stream.readableLength === 200_000, QUICK)
    stream.read()
    expect(req.isPaused()).toBe(false)
  })

  it('reads on without a cap when the limit is Infinity', async () => {
    const { body, req } = build()
    const read = drained(body.stream(UNCAPPED))
    req.end(Buffer.alloc(300_000, 0x61))
    expect(((await read) as string).length).toBe(300_000)
  })

  it('reads a body exactly at the limit', async () => {
    const { body, req } = build()
    const read = drained(body.stream(4))
    req.end('abcd')
    expect(await read).toBe('abcd')
  })

  it('is destroyed with the 413 when the count passes the limit', async () => {
    const { body, req } = build()
    const read = drained(body.stream(4))
    req.write('abc')
    req.write('de')
    expect(await read).toEqual(TOO_LARGE)
  })

  it('pauses the request and stops listening when the count passes the limit, without destroying the request', async () => {
    const { body, req, waiting } = build()
    const read = drained(body.stream(4))
    req.write('abcde')
    await read
    expect({ paused: req.isPaused(), destroyed: req.destroyed, listeners: listeners(req), waiting: waiting() }).toEqual({
      paused: true,
      destroyed: false,
      listeners: [0, 0, 0, 0],
      waiting: 0,
    })
  })

  it('throws the 413 at the call for a declared length above the limit', () => {
    expect(thrownBy(() => build({ 'content-length': '5' }).body.stream(4))).toEqual(TOO_LARGE)
  })

  it('leaves the request alone when it throws the 413 at the call', () => {
    const { body, req, waiting } = build({ 'content-length': '5' })
    thrownBy(() => body.stream(4))
    expect({ listeners: listeners(req), flowing: req.readableFlowing, waiting: waiting() }).toEqual({
      listeners: [0, 0, 0, 0],
      flowing: null,
      waiting: 0,
    })
  })

  it('accepts a declared length equal to the limit', async () => {
    const { body, req } = build({ 'content-length': '4' })
    req.end('abcd')
    expect(await drained(body.stream(4))).toBe('abcd')
  })

  it('accepts any declared length when the limit is Infinity', async () => {
    const { body, req } = build({ 'content-length': '999999999999' })
    req.end('abcd')
    expect(await drained(body.stream(UNCAPPED))).toBe('abcd')
  })

  it('throws the fixed error for a second call', () => {
    const { body } = build()
    body.stream(UNCAPPED)
    expect(thrownBy(() => body.stream(UNCAPPED))).toEqual({ name: 'Error', message: 'body: the body was already read.', status: undefined })
  })

  it('throws the fixed error after bytes()', () => {
    const { body } = build()
    void body.bytes()
    expect(thrownBy(() => body.stream(UNCAPPED))).toEqual({ name: 'Error', message: 'body: the body was already read.', status: undefined })
  })

  it('throws the fixed error after a json() that read the body', () => {
    const { body } = build({ 'content-type': 'application/json' })
    void body.json()
    expect(thrownBy(() => body.stream(UNCAPPED))).toEqual({ name: 'Error', message: 'body: the body was already read.', status: undefined })
  })

  it('throws the fixed error after a call that refused a declared length', () => {
    const { body } = build({ 'content-length': '5' })
    thrownBy(() => body.stream(4))
    expect(thrownBy(() => body.stream(UNCAPPED))).toEqual({ name: 'Error', message: 'body: the body was already read.', status: undefined })
  })

  it.each([
    ['NaN', Number.NaN],
    ['a fraction', 1.5],
    ['a negative number', -1],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
    ['an integer past the safe range', 2 ** 53],
    ['nothing', undefined as unknown as number],
  ])('throws the fixed error for a limit that is %s', (_title, limit) => {
    expect(thrownBy(() => build().body.stream(limit))).toEqual({
      name: 'TypeError',
      message: 'body: the limit must be a non-negative safe integer or Infinity.',
      status: undefined,
    })
  })

  it('leaves the body unread after a limit it refuses', async () => {
    const { body, req } = build()
    thrownBy(() => body.stream(Number.NaN))
    req.end('still here')
    expect((await body.bytes()).toString()).toBe('still here')
  })

  it('pauses the request and stops listening when it is destroyed, without destroying the request', () => {
    const { body, req, waiting } = build()
    const stream = body.stream(UNCAPPED)
    stream.read(0)
    stream.destroy()
    expect({ paused: req.isPaused(), destroyed: req.destroyed, listeners: listeners(req), waiting: waiting() }).toEqual({
      paused: true,
      destroyed: false,
      listeners: [0, 0, 0, 0],
      waiting: 0,
    })
  })

  it('does not throw when it is destroyed past the limit while only piped', async () => {
    const { body, req } = build()
    const stream = body.stream(4)
    stream.pipe(new PassThrough())
    req.write('abcde')
    await waitUntil(() => stream.destroyed, QUICK)
    expect(failureOf(stream)).toEqual(TOO_LARGE)
  })

  it('does not end or destroy the destination of a pipe when it fails', async () => {
    const { body, req } = build()
    const stream = body.stream(4)
    const destination = stream.pipe(new PassThrough())
    req.write('abcde')
    await waitUntil(() => stream.destroyed, QUICK)
    expect({ destroyed: destination.destroyed, ended: destination.writableEnded }).toEqual({ destroyed: false, ended: false })
  })

  it('does not throw when it is cut short before any consumer attached', async () => {
    const { body, req } = build()
    const stream = body.stream(UNCAPPED)
    req.emit('close')
    await waitUntil(() => stream.destroyed, QUICK)
    expect(failureOf(stream)).toEqual(INCOMPLETE)
  })

  it('still gives the failure to a for await that attaches afterwards', async () => {
    const { body, req } = build()
    const stream = body.stream(UNCAPPED)
    req.emit('close')
    await waitUntil(() => stream.destroyed, QUICK)
    expect(await drained(stream)).toEqual(INCOMPLETE)
  })

  it('gives the failure to a pipeline that reads it', async () => {
    const { body, req } = build()
    const read = pipeline(body.stream(4), new PassThrough()).catch((error: Error & { status?: number }) => ({
      name: error.name,
      message: error.message,
      status: error.status,
    }))
    req.write('abcde')
    expect(await read).toEqual(TOO_LARGE)
  })

  it('gives the failure to a listener of the consumer as well as to its own', async () => {
    const { body, end } = build()
    const stream = body.stream(UNCAPPED)
    const seen: string[] = []
    stream.on('error', (error) => void seen.push(error.message))
    end()
    await waitUntil(() => seen.length > 0, QUICK)
    expect(seen).toEqual(['body-incomplete'])
  })

  it('carries one error listener of the kernel before it is handed out', () => {
    expect(build().body.stream(UNCAPPED).listenerCount('error')).toBe(1)
  })
})

/**
 * Builds a body whose client waits for `100 Continue` and whose response is queued behind an earlier one on its connection.
 *
 * @returns The body, the fake response that has no socket yet, and the fake exchange.
 */
const queued = () => {
  const req = Object.assign(new PassThrough(), { headers: {} })
  const res = Object.assign(new EventEmitter(), {
    continued: 0,
    headersSent: false,
    socket: null,
    writeContinue: () => void (res.continued += 1),
  })
  const exchange = { expectsContinue: true, ended: false, onEnd: () => () => undefined }
  return { body: createRequestBody(req as unknown as IncomingMessage, res as unknown as ServerResponse, exchange, 65536), res, exchange }
}

describe('createRequestBody continue on a queued response', () => {
  it('holds 100 Continue back while the response has no socket', () => {
    const { body, res } = queued()
    void body.bytes()
    expect(res.continued).toBe(0)
  })

  it('writes it when the response gets its socket', () => {
    const { body, res } = queued()
    body.stream(UNCAPPED)
    res.emit('socket')
    expect(res.continued).toBe(1)
  })

  it('does not write it when a head was written before the socket came, where it would land inside the response', () => {
    const { body, res } = queued()
    void body.bytes()
    res.headersSent = true
    res.emit('socket')
    expect(res.continued).toBe(0)
  })

  it('does not write it when the exchange ended before the socket came', () => {
    const { body, res, exchange } = queued()
    void body.bytes()
    exchange.ended = true
    res.emit('socket')
    expect(res.continued).toBe(0)
  })
})
