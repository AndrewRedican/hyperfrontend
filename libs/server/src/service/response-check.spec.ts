import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from '@hyperfrontend/testing'
import { guardStream, isStale, releaseBody, responseProblem } from './response-check'

/**
 * Builds a stream that produces nothing until the spec pushes into it.
 *
 * @param autoDestroy - Whether the stream destroys itself once it ends or errors.
 * @returns A readable the spec feeds by hand.
 */
const quietStream = (autoDestroy = true): Readable => new Readable({ autoDestroy, read: () => undefined })

/**
 * Waits for one event of a stream.
 *
 * @param stream - The stream to listen on.
 * @param event - The event name.
 * @returns A promise for the event's first argument.
 */
const eventOf = (stream: Readable, event: string): Promise<unknown> => new Promise((resolve) => stream.once(event, resolve))

/**
 * Builds an object whose named property throws when it is read.
 *
 * @param name - The property that cannot be read.
 * @param rest - The readable properties beside it.
 * @returns The object.
 */
const unreadable = (name: string, rest: Record<string, unknown>): unknown =>
  Object.defineProperty({ ...rest }, name, {
    enumerable: true,
    get: () => {
      throw new Error('unreadable')
    },
  })

describe('responseProblem', () => {
  it('accepts a static response that declares the length of its bytes', () => {
    expect(responseProblem({ status: 200, headers: { 'Content-Length': '2' }, body: Buffer.from('ok') })).toBeNull()
  })

  it('accepts a stream body', () => {
    expect(responseProblem({ status: 200, headers: {}, body: quietStream() })).toBeNull()
  })

  it('accepts a duplex stream body', () => {
    expect(responseProblem({ status: 200, headers: {}, body: new PassThrough() })).toBeNull()
  })

  it('accepts a response without a body', () => {
    expect(responseProblem({ status: 204, headers: {}, body: null })).toBeNull()
  })

  it('accepts cookies', () => {
    expect(responseProblem({ status: 200, headers: {}, cookies: ['a=1; Path=/', 'b=2'], body: null })).toBeNull()
  })

  it('accepts an empty list of cookies', () => {
    expect(responseProblem({ status: 200, headers: {}, cookies: [], body: null })).toBeNull()
  })

  it('accepts headers without a prototype', () => {
    expect(responseProblem({ status: 200, headers: Object.assign(Object.create(null), { ETag: 'W/"1"' }), body: null })).toBeNull()
  })

  it('accepts the two ends of the status range', () => {
    expect([200, 599].map((status) => responseProblem({ status, headers: {}, body: null }))).toEqual([null, null])
  })

  it.each([
    ['a string', 'ok'],
    ['a number', 200],
    ['undefined', undefined],
    ['null', null],
    ['a function', () => ({ status: 200, headers: {}, body: null })],
  ])('refuses %s as not an object', (_label, value) => {
    expect(responseProblem(value)).toBe('the response is not an object')
  })

  it.each([
    ['199', 199],
    ['600', 600],
    ['200.5', 200.5],
    ['a numeric string', '200'],
    ['nothing', undefined],
  ])('refuses the status %s', (_label, status) => {
    expect(responseProblem({ status, headers: {}, body: null })).toBe('the status is not an integer between 200 and 599')
  })

  it.each([
    ['nothing', undefined],
    ['a fetch Headers', new Headers({ ETag: 'W/"1"' })],
    ['a Map', new Map([['ETag', 'W/"1"']])],
    ['an array', [['ETag', 'W/"1"']]],
  ])('refuses headers that are %s', (_label, headers) => {
    expect(responseProblem({ status: 200, headers, body: null })).toBe('the headers are not a plain object')
  })

  it('refuses a header the header rules refuse', () => {
    expect(responseProblem({ status: 200, headers: { Connection: 'close' }, body: null })).toBe('a header belongs to the connection')
  })

  it.each([
    ['a string', 'a=1'],
    ['a Set', new Set(['a=1'])],
    ['null', null],
  ])('refuses cookies that are %s', (_label, cookies) => {
    expect(responseProblem({ status: 200, headers: {}, cookies, body: null })).toBe('the cookies are not an array')
  })

  it.each([
    ['an empty cookie', ['a=1', '']],
    ['a cookie that is not a string', ['a=1', 2]],
    ['a cookie with a line feed', ['a=1\nSet-Cookie: b=2']],
    ['a cookie with a carriage return', ['a=1\r']],
  ])('refuses %s', (_label, cookies) => {
    expect(responseProblem({ status: 200, headers: {}, cookies, body: null })).toBe('a cookie is not a valid header value')
  })

  it.each([
    ['a Uint8Array', new Uint8Array([111, 107])],
    ['a string', 'ok'],
    ['nothing', undefined],
    [
      'an async generator',
      (async function* body() {
        yield Buffer.from('ok')
      })(),
    ],
  ])('refuses a body that is %s', (_label, body) => {
    expect(responseProblem({ status: 200, headers: {}, body })).toBe('the body is not bytes, a stream or null')
  })

  it.each(['status', 'headers', 'cookies', 'body'])('refuses, without throwing, a response whose %s cannot be read', (name) => {
    expect(responseProblem(unreadable(name, { status: 200, headers: {}, body: null }))).toBe('the response could not be read')
  })

  it('holds nothing of the response in what it reports', () => {
    expect(responseProblem({ status: 200, headers: {}, cookies: ['marker=1\n'], body: null })).not.toMatch(/marker/)
  })
})

describe('isStale', () => {
  it('finds a new stream fresh', () => {
    expect(isStale(quietStream())).toBe(false)
  })

  it('finds a stream with buffered chunks nobody read fresh', () => {
    const stream = quietStream()
    stream.push('chunk')
    expect(isStale(stream)).toBe(false)
  })

  it('finds a stream that is being piped into fresh', () => {
    const body = new PassThrough()
    Readable.from(['chunk']).pipe(body)
    expect(isStale(body)).toBe(false)
  })

  it('finds a destroyed stream stale', () => {
    const stream = quietStream()
    stream.destroy()
    expect(isStale(stream)).toBe(true)
  })

  it('finds a stream read to its end stale', async () => {
    const stream = quietStream(false)
    stream.push(null)
    stream.resume()
    await eventOf(stream, 'end')
    expect({ destroyed: stream.destroyed, stale: isStale(stream) }).toEqual({ destroyed: false, stale: true })
  })

  it('finds a stream that was read from stale', () => {
    const stream = quietStream()
    stream.push('chunk')
    stream.read()
    expect({ ended: stream.readableEnded, stale: isStale(stream) }).toEqual({ ended: false, stale: true })
  })

  it('finds a stream that failed stale although nothing destroyed it', async () => {
    const stream = new Readable({
      autoDestroy: false,
      read: () => {
        throw new Error('the source failed')
      },
    })
    const failed = eventOf(stream, 'error')
    stream.resume()
    await failed
    expect({ destroyed: stream.destroyed, stale: isStale(stream) }).toEqual({ destroyed: false, stale: true })
  })

  it('finds a stream destroyed with an error stale', async () => {
    const stream = quietStream()
    const failed = eventOf(stream, 'error')
    stream.destroy(new Error('the source failed'))
    await failed
    expect(isStale(stream)).toBe(true)
  })
})

describe('guardStream', () => {
  it('lets a stream fail with no other listener', async () => {
    const stream = quietStream()
    guardStream(stream)
    stream.destroy(new Error('the source failed'))
    await eventOf(stream, 'close')
    expect(stream.errored?.message).toBe('the source failed')
  })

  it('adds one listener however often it is asked', () => {
    const stream = quietStream()
    guardStream(stream)
    guardStream(stream)
    expect(stream.listenerCount('error')).toBe(1)
  })

  it('leaves the error to a listener of the consumer', async () => {
    const stream = quietStream()
    guardStream(stream)
    const received = eventOf(stream, 'error')
    stream.destroy(new Error('the source failed'))
    expect(await received).toEqual(new Error('the source failed'))
  })

  it('guards each stream on its own', () => {
    const first = quietStream()
    const second = quietStream()
    guardStream(first)
    guardStream(second)
    expect([first.listenerCount('error'), second.listenerCount('error')]).toEqual([1, 1])
  })
})

describe('releaseBody', () => {
  it('destroys the stream body of a response', () => {
    const body = quietStream()
    releaseBody({ status: 200, headers: {}, body })
    expect(body.destroyed).toBe(true)
  })

  it('destroys a stream handed over on its own', () => {
    const body = quietStream()
    releaseBody(body)
    expect(body.destroyed).toBe(true)
  })

  it('destroys the stream body of a value that is no valid response', () => {
    const body = quietStream()
    releaseBody({ status: 'broken', body })
    expect(body.destroyed).toBe(true)
  })

  it('listens for the error a destroyed stream may still raise', async () => {
    const body = new Readable({
      read: () => undefined,
      destroy: (_error, callback) => callback(new Error('the source failed to close')),
    })
    releaseBody({ status: 200, headers: {}, body })
    await eventOf(body, 'close')
    expect(body.errored?.message).toBe('the source failed to close')
  })

  it('leaves the bytes of a buffer body as they were', () => {
    const body = Buffer.from('ok')
    releaseBody({ status: 200, headers: {}, body })
    expect(body.toString()).toBe('ok')
  })

  it.each([
    ['a response without a body', { status: 204, headers: {}, body: null }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ok'],
    ['a response whose body cannot be read', unreadable('body', { status: 200, headers: {} })],
  ])('ignores %s', (_label, value) => {
    expect(() => releaseBody(value)).not.toThrow()
  })
})
