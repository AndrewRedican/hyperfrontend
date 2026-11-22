import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Readable } from 'node:stream'
import type { RequestBody } from './contract'
import { PassThrough } from 'node:stream'
import { describe, expect, flushPromises, it, waitUntil } from '@hyperfrontend/testing'
import { createRequestBody } from './request-body'

/** What one fake body is built over; everything has a default. */
interface Setup {
  /** The request headers, lower-cased. */
  readonly headers?: IncomingHttpHeaders
  /** The service's default cap. */
  readonly bodyBytes?: number
  /** Whether the request expects `100 Continue`. */
  readonly expectsContinue?: boolean
  /** Whether the fake request closes by itself once it has ended; a real one closes later, with its response. */
  readonly autoDestroy?: boolean
}

/** One fake body and everything around it a spec drives or reads. */
interface Harness {
  /** The body under test. */
  readonly body: RequestBody
  /** The fake request stream. */
  readonly req: PassThrough
  /** The fake response: how often `100 Continue` was written, and whether a head went out. */
  readonly res: { continued: number; headersSent: boolean }
  /** Ends the fake exchange. */
  end(): void
  /** How many callbacks wait for the end of the fake exchange. */
  waiting(): number
}

const LISTENED = ['data', 'end', 'error', 'close'] as const
const QUICK = { interval: 1 }

/**
 * Builds a body over a fake request, response and exchange.
 *
 * @param setup - What differs from a request without headers on a service with the default cap.
 * @returns The body and its surroundings.
 */
const build = (setup: Setup = {}): Harness => {
  const req = Object.assign(new PassThrough({ autoDestroy: setup.autoDestroy ?? true }), { headers: setup.headers ?? {} })
  const res = { continued: 0, headersSent: false, writeContinue: () => void (res.continued += 1) }
  const callbacks = new Set<() => void>()
  const state = { ended: false }
  const exchange = {
    expectsContinue: setup.expectsContinue ?? false,
    get ended(): boolean {
      return state.ended
    },
    onEnd: (callback: () => void): (() => void) => {
      callbacks.add(callback)
      return () => void callbacks.delete(callback)
    },
  }
  return {
    body: createRequestBody(req as unknown as IncomingMessage, res as unknown as ServerResponse, exchange, setup.bodyBytes ?? 65536),
    req,
    res,
    end: () => {
      state.ended = true
      for (const callback of [...callbacks]) callback()
    },
    waiting: () => callbacks.size,
  }
}

/**
 * Describes how a promise settled, so one assertion can read a rejection.
 *
 * @param promise - The promise a reader returned.
 * @returns The resolved value, or what an error carries that a client or a log could see.
 */
const outcomeOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    return await promise
  } catch (error) {
    const { name, message, status } = error as Error & { status?: number }
    return { name, message, status }
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

const TOO_LARGE = { name: 'HttpError', message: 'body-too-large', status: 413 }
const INCOMPLETE = { name: 'HttpError', message: 'body-incomplete', status: 400 }
const MALFORMED = { name: 'HttpError', message: 'malformed-body', status: 400 }
const JSON_TYPE = { 'content-type': 'application/json' }

describe('createRequestBody length', () => {
  it('is the declared length when it is decimal digits', () => {
    expect(build({ headers: { 'content-length': '42' } }).body.length).toBe(42)
  })

  it('is null without a declared length', () => {
    expect(build().body.length).toBeNull()
  })

  it('is null for a chunked body', () => {
    expect(build({ headers: { 'transfer-encoding': 'chunked' } }).body.length).toBeNull()
  })

  it.each(['', '1e3', '-1', '4 ', '0x10', '1.5'])('is null for the declared length %j', (declared) => {
    expect(build({ headers: { 'content-length': declared } }).body.length).toBeNull()
  })

  it('reads nothing and leaves the request alone until a reader is called', () => {
    const { req, res } = build({ expectsContinue: true })
    expect({ listeners: listeners(req), flowing: req.readableFlowing, continued: res.continued }).toEqual({
      listeners: [0, 0, 0, 0],
      flowing: null,
      continued: 0,
    })
  })

  it('is frozen', () => {
    expect(Object.isFrozen(build().body)).toBe(true)
  })
})

describe('createRequestBody bytes', () => {
  it('reads several chunks as one buffer', async () => {
    const { body, req } = build()
    const read = body.bytes()
    req.write('ab')
    req.write('cd')
    req.end('ef')
    expect((await read).toString()).toBe('abcdef')
  })

  it('reads a request without a body as zero bytes', async () => {
    const { body, req } = build()
    req.end()
    expect((await body.bytes()).length).toBe(0)
  })

  it('reads once for two calls', async () => {
    const { body, req } = build()
    req.end('once')
    const first = await body.bytes()
    expect(await body.bytes()).toBe(first)
  })

  it('reads once for concurrent calls', async () => {
    const { body, req } = build()
    const reads = [body.bytes(), body.bytes()]
    req.end('once')
    const [first, second] = await Promise.all(reads)
    expect(first).toBe(second)
  })

  it('listens once for concurrent calls', () => {
    const { body, req } = build()
    void body.bytes()
    void body.bytes()
    expect(listeners(req)).toEqual([1, 1, 1, 1])
  })

  it('removes its listeners and its end callback when the body has been read', async () => {
    const { body, req, waiting } = build()
    req.end('done')
    await body.bytes()
    expect({ listeners: listeners(req), waiting: waiting() }).toEqual({ listeners: [0, 0, 0, 0], waiting: 0 })
  })

  it('removes its listeners and its end callback at the end of a request that stays open', async () => {
    const { body, req, waiting } = build({ autoDestroy: false })
    req.end('done')
    await body.bytes()
    expect({ listeners: listeners(req), waiting: waiting(), closed: req.destroyed }).toEqual({
      listeners: [0, 0, 0, 0],
      waiting: 0,
      closed: false,
    })
  })

  it('refuses a declared length above the limit', async () => {
    const { body } = build({ headers: { 'content-length': '5' } })
    expect(await outcomeOf(body.bytes(4))).toEqual(TOO_LARGE)
  })

  it('reads nothing for a declared length above the limit', async () => {
    const { body, req, waiting } = build({ headers: { 'content-length': '5' } })
    await outcomeOf(body.bytes(4))
    expect({ listeners: listeners(req), flowing: req.readableFlowing, waiting: waiting() }).toEqual({
      listeners: [0, 0, 0, 0],
      flowing: null,
      waiting: 0,
    })
  })

  it('accepts a declared length equal to the limit', async () => {
    const { body, req } = build({ headers: { 'content-length': '4' } })
    req.end('abcd')
    expect((await body.bytes(4)).toString()).toBe('abcd')
  })

  it('refuses a body whose counted length passes the limit', async () => {
    const { body, req } = build()
    const read = outcomeOf(body.bytes(4))
    req.write('abc')
    req.write('de')
    expect(await read).toEqual(TOO_LARGE)
  })

  it('pauses the request and stops listening when the count passes the limit', async () => {
    const { body, req, waiting } = build()
    const read = outcomeOf(body.bytes(4))
    req.write('abcde')
    await read
    expect({ paused: req.isPaused(), destroyed: req.destroyed, listeners: listeners(req), waiting: waiting() }).toEqual({
      paused: true,
      destroyed: false,
      listeners: [0, 0, 0, 0],
      waiting: 0,
    })
  })

  it('accepts a body exactly at the limit', async () => {
    const { body, req } = build()
    req.end('abcd')
    expect((await body.bytes(4)).toString()).toBe('abcd')
  })

  it('accepts a limit of zero for an empty body', async () => {
    const { body, req } = build()
    req.end()
    expect((await body.bytes(0)).length).toBe(0)
  })

  it('refuses a later call whose limit is below the bytes already read', async () => {
    const { body, req } = build()
    req.end('abcd')
    await body.bytes()
    expect(await outcomeOf(body.bytes(3))).toEqual(TOO_LARGE)
  })

  it('gives a later call with a limit of exactly the byte length the same buffer', async () => {
    const { body, req } = build()
    req.end('abcd')
    const first = await body.bytes()
    expect(await body.bytes(4)).toBe(first)
  })

  it('gives a later call the same failure as the first, whatever its limit', async () => {
    const { body } = build({ headers: { 'content-length': '5' } })
    const first = await body.bytes(4).catch((error: unknown) => error)
    expect(await body.bytes(100).catch((error: unknown) => error)).toBe(first)
  })

  it('refuses a content encoding', async () => {
    const { body } = build({ headers: { 'content-encoding': 'gzip' } })
    expect(await outcomeOf(body.bytes())).toEqual({ name: 'HttpError', message: 'unsupported-content-encoding', status: 415 })
  })

  it('refuses an empty content encoding', async () => {
    const { body } = build({ headers: { 'content-encoding': '' } })
    expect(await outcomeOf(body.bytes())).toEqual({ name: 'HttpError', message: 'unsupported-content-encoding', status: 415 })
  })

  it('reads nothing for a content encoding it refuses', async () => {
    const { body, req } = build({ headers: { 'content-encoding': 'gzip' } })
    await outcomeOf(body.bytes())
    expect({ listeners: listeners(req), flowing: req.readableFlowing }).toEqual({ listeners: [0, 0, 0, 0], flowing: null })
  })

  it('accepts the identity encoding in any case and with spaces around it', async () => {
    const { body, req } = build({ headers: { 'content-encoding': ' Identity ' } })
    req.end('plain')
    expect((await body.bytes()).toString()).toBe('plain')
  })

  it.each([
    ['a fraction', 1.5],
    ['a negative number', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an integer past the safe range', 2 ** 53],
    ['a string', '4' as unknown as number],
    ['null', null as unknown as number],
  ])('rejects with the fixed error for a limit that is %s', async (_title, limit) => {
    expect(await outcomeOf(build().body.bytes(limit))).toEqual({
      name: 'TypeError',
      message: 'body: the limit must be a non-negative safe integer.',
      status: undefined,
    })
  })

  it('reads nothing for a limit it refuses', async () => {
    const { body, req } = build()
    await outcomeOf(body.bytes(-1))
    expect(listeners(req)).toEqual([0, 0, 0, 0])
  })

  it('leaves the body unread after a limit it refuses, so a stream may still take it', async () => {
    const { body, req } = build()
    await outcomeOf(body.bytes(-1))
    req.end('later')
    expect(await drained(body.stream(Number.POSITIVE_INFINITY))).toBe('later')
  })

  it('caps at the default of the service when the call gives no limit', async () => {
    const { body, req } = build({ bodyBytes: 4 })
    const read = outcomeOf(body.bytes())
    req.write('abcde')
    expect(await read).toEqual(TOO_LARGE)
  })

  it('reads up to the default of the service when the call gives no limit', async () => {
    const { body, req } = build({ bodyBytes: 4 })
    req.end('abcd')
    expect((await body.bytes()).toString()).toBe('abcd')
  })

  it('rejects with the fixed error once the body was streamed', async () => {
    const { body } = build()
    body.stream(Number.POSITIVE_INFINITY)
    expect(await outcomeOf(body.bytes())).toEqual({ name: 'Error', message: 'body: the body was already streamed.', status: undefined })
  })

  it('does not fail the run for a rejected read nobody awaits', async () => {
    const { body } = build({ headers: { 'content-length': '5' } })
    void body.bytes(4)
    void body.bytes(-1)
    // why: the runner fails this file on an unhandled rejection, so reaching the assertion is the proof
    expect(await flushPromises()).toBeUndefined()
  })
})

describe('createRequestBody json', () => {
  it('parses a JSON body', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end('{"id":7,"tags":["a","b"]}')
    expect(await body.json()).toEqual({ id: 7, tags: ['a', 'b'] })
  })

  it('decodes the body as UTF-8', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end(Buffer.from('"caf\u00e9"', 'utf8'))
    expect(await body.json()).toBe('caf\u00e9')
  })

  it('refuses a request without a content type', async () => {
    expect(await outcomeOf(build().body.json())).toEqual({ name: 'HttpError', message: 'unsupported-media-type', status: 415 })
  })

  it.each(['text/plain', 'application/json-seq', 'application/jsonx; charset=utf-8', 'text/plain; application/json'])(
    'refuses the content type %s',
    async (type) => {
      expect(await outcomeOf(build({ headers: { 'content-type': type } }).body.json())).toEqual({
        name: 'HttpError',
        message: 'unsupported-media-type',
        status: 415,
      })
    }
  )

  it('accepts the media type in any case, with spaces and with parameters', async () => {
    const { body, req } = build({ headers: { 'content-type': ' Application/JSON ; charset=utf-8' } })
    req.end('[1]')
    expect(await body.json()).toEqual([1])
  })

  it('reads nothing for a media type it refuses, so a stream may still take the body', async () => {
    const { body, req } = build({ headers: { 'content-type': 'text/plain' } })
    await outcomeOf(body.json())
    req.end('plain text')
    expect(await drained(body.stream(Number.POSITIVE_INFINITY))).toBe('plain text')
  })

  it('judges the media type before the limit', async () => {
    expect(await outcomeOf(build().body.json(-1))).toEqual({ name: 'HttpError', message: 'unsupported-media-type', status: 415 })
  })

  it('refuses bytes that are not UTF-8', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end(Buffer.from([0x22, 0xc3, 0x28, 0x22]))
    expect(await outcomeOf(body.json())).toEqual(MALFORMED)
  })

  it('refuses malformed JSON', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end('{"id":')
    expect(await outcomeOf(body.json())).toEqual(MALFORMED)
  })

  it('refuses the empty body', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end()
    expect(await outcomeOf(body.json())).toEqual(MALFORMED)
  })

  it('carries nothing of the input in the failure of a malformed body', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end('{"marker-in-the-body" oops')
    const failure = await body.json().catch((error: Error) => error)
    expect(`${String(failure)} ${JSON.stringify(failure)} ${(failure as Error).stack}`).not.toContain('marker-in-the-body')
  })

  it('passes its limit to the read', async () => {
    const { body } = build({ headers: { ...JSON_TYPE, 'content-length': '5' } })
    expect(await outcomeOf(body.json(4))).toEqual(TOO_LARGE)
  })

  it('caps at the default of the service when the call gives no limit', async () => {
    const { body } = build({ headers: { ...JSON_TYPE, 'content-length': '5' }, bodyBytes: 4 })
    expect(await outcomeOf(body.json())).toEqual(TOO_LARGE)
  })

  it('rejects with the fixed error for a limit that is not a non-negative safe integer', async () => {
    expect(await outcomeOf(build({ headers: JSON_TYPE }).body.json(1.5))).toEqual({
      name: 'TypeError',
      message: 'body: the limit must be a non-negative safe integer.',
      status: undefined,
    })
  })

  it('refuses a content encoding', async () => {
    const { body } = build({ headers: { ...JSON_TYPE, 'content-encoding': 'br' } })
    expect(await outcomeOf(body.json())).toEqual({ name: 'HttpError', message: 'unsupported-content-encoding', status: 415 })
  })

  it('parses again on each call, from the bytes read once', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end('{"id":7}')
    const first = await body.json()
    const second = await body.json()
    expect({ equal: JSON.stringify(first) === JSON.stringify(second), same: first === second }).toEqual({ equal: true, same: false })
  })

  it('parses the bytes a signature check read first', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    req.end('{"signed":true}')
    await body.bytes()
    expect(await body.json()).toEqual({ signed: true })
  })

  it('rejects with the fixed error once the body was streamed', async () => {
    const { body } = build({ headers: JSON_TYPE })
    body.stream(Number.POSITIVE_INFINITY)
    expect(await outcomeOf(body.json())).toEqual({ name: 'Error', message: 'body: the body was already streamed.', status: undefined })
  })

  it('does not fail the run for a rejected parse nobody awaits', async () => {
    const { body, req } = build({ headers: JSON_TYPE })
    void build().body.json()
    void body.json()
    req.end('not json')
    // why: the runner fails this file on an unhandled rejection, so reaching the assertion is the proof
    expect(await waitUntil(() => req.readableEnded, QUICK)).toBe(true)
  })
})

describe('createRequestBody cut short', () => {
  it('rejects a pending read when the request closes before its end', async () => {
    const { body, req } = build()
    const read = outcomeOf(body.bytes())
    req.write('partial')
    req.destroy()
    expect(await read).toEqual(INCOMPLETE)
  })

  it('rejects a pending read when the request fails', async () => {
    const { body, req } = build()
    const read = outcomeOf(body.bytes())
    req.emit('error', new Error('the socket was reset'))
    expect(await read).toEqual(INCOMPLETE)
  })

  it('stops listening once a read was cut short', async () => {
    const { body, req, waiting } = build()
    const read = outcomeOf(body.bytes())
    req.emit('error', new Error('the socket was reset'))
    await read
    expect({ listeners: listeners(req), waiting: waiting() }).toEqual({ listeners: [0, 0, 0, 0], waiting: 0 })
  })

  it('rejects a pending read when the exchange ends although the request emitted nothing', async () => {
    const { body, end } = build()
    const read = outcomeOf(body.bytes())
    end()
    expect(await read).toEqual(INCOMPLETE)
  })

  it('rejects a pending parse when the exchange ends', async () => {
    const { body, end } = build({ headers: JSON_TYPE })
    const read = outcomeOf(body.json())
    end()
    expect(await read).toEqual(INCOMPLETE)
  })

  it('rejects a read started after the exchange ended, without touching the request', async () => {
    const { body, req, end } = build()
    end()
    const read = await outcomeOf(body.bytes())
    expect({ read, listeners: listeners(req) }).toEqual({ read: INCOMPLETE, listeners: [0, 0, 0, 0] })
  })

  it('keeps the bytes of a read that finished before the exchange ended', async () => {
    const { body, req, end } = build()
    req.end('whole')
    await body.bytes()
    end()
    expect((await body.bytes()).toString()).toBe('whole')
  })

  it('destroys the stream with the failure when the request closes before its end', async () => {
    const { body, req } = build()
    const stream = body.stream(Number.POSITIVE_INFINITY)
    const read = drained(stream)
    req.write('partial')
    req.destroy()
    expect(await read).toEqual(INCOMPLETE)
  })

  it('destroys the stream with the failure when the request fails', async () => {
    const { body, req } = build()
    const read = drained(body.stream(Number.POSITIVE_INFINITY))
    req.emit('error', new Error('the socket was reset'))
    expect(await read).toEqual(INCOMPLETE)
  })

  it('destroys the stream with the failure when the exchange ends although the request emitted nothing', async () => {
    const { body, end } = build()
    const read = drained(body.stream(Number.POSITIVE_INFINITY))
    end()
    expect(await read).toEqual(INCOMPLETE)
  })

  it('hands out a stream that has already failed when it is asked for after the exchange ended', async () => {
    const { body, req, end } = build()
    end()
    const read = await drained(body.stream(Number.POSITIVE_INFINITY))
    expect({ read, listeners: listeners(req) }).toEqual({ read: INCOMPLETE, listeners: [0, 0, 0, 0] })
  })

  it('gives a stream asked for after the exchange ended the error listener of the kernel, so one nobody reads does not throw', () => {
    const { body, end } = build()
    end()
    expect(body.stream(Number.POSITIVE_INFINITY).listenerCount('error')).toBe(1)
  })

  it('lets a stream whose request ended be read after the exchange ended', async () => {
    const { body, req, end } = build()
    const stream = body.stream(Number.POSITIVE_INFINITY)
    stream.read(0)
    req.end('buffered')
    await waitUntil(() => req.readableEnded, QUICK)
    end()
    expect(await drained(stream)).toBe('buffered')
  })
})

describe('createRequestBody continue', () => {
  it('writes 100 Continue on the first read', () => {
    const { body, res } = build({ expectsContinue: true })
    void body.bytes()
    expect(res.continued).toBe(1)
  })

  it('writes it once across two reads', async () => {
    const { body, req, res } = build({ expectsContinue: true })
    req.end('abcd')
    await body.bytes()
    await body.bytes()
    expect(res.continued).toBe(1)
  })

  it('writes it once across a read and a parse', async () => {
    const { body, req, res } = build({ expectsContinue: true, headers: JSON_TYPE })
    req.end('1')
    await body.bytes()
    await body.json()
    expect(res.continued).toBe(1)
  })

  it('does not write it for a declared length above the limit', async () => {
    const { body, res } = build({ expectsContinue: true, headers: { 'content-length': '5' } })
    await outcomeOf(body.bytes(4))
    expect(res.continued).toBe(0)
  })

  it('does not write it for a content encoding it refuses', async () => {
    const { body, res } = build({ expectsContinue: true, headers: { 'content-encoding': 'gzip' } })
    await outcomeOf(body.bytes())
    expect(res.continued).toBe(0)
  })

  it('does not write it for a media type it refuses', async () => {
    const { body, res } = build({ expectsContinue: true, headers: { 'content-type': 'text/plain' } })
    await outcomeOf(body.json())
    expect(res.continued).toBe(0)
  })

  it('does not write it for a request that did not ask', async () => {
    const { body, req, res } = build()
    req.end()
    await body.bytes()
    expect(res.continued).toBe(0)
  })

  it('does not write it once the exchange ended', async () => {
    const { body, res, end } = build({ expectsContinue: true })
    end()
    await outcomeOf(body.bytes())
    expect(res.continued).toBe(0)
  })

  it('does not write it once a head was written, where it would land inside the response', () => {
    const { body, res } = build({ expectsContinue: true })
    res.headersSent = true
    void body.bytes()
    expect(res.continued).toBe(0)
  })

  it('writes it at the call of stream()', () => {
    const { body, res } = build({ expectsContinue: true })
    body.stream(Number.POSITIVE_INFINITY)
    expect(res.continued).toBe(1)
  })

  it('does not write it when stream() refuses a declared length', () => {
    const { body, res } = build({ expectsContinue: true, headers: { 'content-length': '5' } })
    thrownBy(() => body.stream(4))
    expect(res.continued).toBe(0)
  })
})
