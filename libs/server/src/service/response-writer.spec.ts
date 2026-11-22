import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServiceClock } from './clock'
import type { ServiceResponse } from './contract'
import type { ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough, Readable } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createExchange } from './exchange'
import { writeResponse } from './response-writer'

/** One timer of the fake clock. */
interface Timer {
  /** What the timer runs when a spec fires it. */
  readonly callback: () => void
  /** The delay it was started with. */
  readonly ms: number
  /** Whether it was cancelled. */
  cleared: boolean
}

/** The fake response: it records every call and answers a write as a spec tells it to. */
interface FakeResponse extends EventEmitter {
  /** The socket the response writes to, or `null` while it is queued behind an earlier response. */
  socket: unknown
  /** Whether the response has been flushed. */
  writableFinished: boolean
  /** Every call in order: the method, then its arguments. */
  readonly calls: unknown[][]
  /** What the next calls of `write` return; `true` once the list is empty. */
  readonly accepts: boolean[]
}

/** What one fake exchange is started with. */
interface Setup {
  /** The request method. */
  readonly method?: string
  /** Whether the request has been received completely. */
  readonly complete?: boolean
}

/** One fake exchange and everything around it a spec drives or reads. */
interface Harness {
  /** The exchange the response is written for. */
  readonly exchange: Exchange
  /** The fake response. */
  readonly res: FakeResponse
  /** The fake socket, which counts the times it was destroyed. */
  readonly socket: EventEmitter & { destroyed: number }
  /** Every event the sink received. */
  readonly events: ServiceEvent[]
  /** Every timer the writer started. */
  readonly timers: Timer[]
  /** The fake clock, which only records timers. */
  readonly clock: ServiceClock
  /** Writes a response for the exchange. */
  write(response: ServiceResponse, draining?: boolean): Promise<void>
  /** Flushes the fake response and closes it, as Node does after the last byte. */
  finish(): void
}

const SLICE = 65536

/**
 * Starts an exchange over a fake request, response, socket and clock.
 *
 * @param setup - What differs from a completely received `GET /`.
 * @returns The exchange and its surroundings.
 */
const start = (setup: Setup = {}): Harness => {
  const socket = Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    destroyed: 0,
    destroy: () => void (socket.destroyed += 1),
  })
  const req = Object.assign(new PassThrough(), {
    method: setup.method ?? 'GET',
    url: '/',
    headers: {},
    complete: setup.complete ?? true,
    socket,
  })
  const calls: unknown[][] = []
  const accepts: boolean[] = []
  const res: FakeResponse = Object.assign(new EventEmitter(), {
    socket: socket as unknown,
    writableFinished: false,
    calls,
    accepts,
    setHeader: (name: string, value: unknown) => void calls.push(['setHeader', name, value]),
    writeHead: (status: number) => void calls.push(['writeHead', status]),
    write: (chunk: Uint8Array) => {
      calls.push(['write', chunk])
      return accepts.shift() ?? true
    },
    end: (...chunk: Uint8Array[]) => void calls.push(['end', ...chunk]),
  })
  const events: ServiceEvent[] = []
  const timers: Timer[] = []
  const clock = {
    now: () => 0,
    setTimeout: (callback: () => void, ms: number) => {
      const timer = { callback, ms, cleared: false }
      timers.push(timer)
      return timer
    },
    clearTimeout: (handle: unknown) => void ((handle as Timer).cleared = true),
  }
  const exchange = createExchange(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    { bodyBytes: SLICE, trustedProxyHops: 0 },
    clock,
    (event) => void events.push(event),
    false
  )
  return {
    exchange,
    res,
    socket,
    events,
    timers,
    clock,
    write: (response, draining = false) => writeResponse(exchange, response, { writeIdleTimeoutMs: 30000 }, clock, () => draining),
    finish: () => {
      res.writableFinished = true
      res.emit('finish')
      res.emit('close')
    },
  }
}

/**
 * Lists the header lines a fake response was given, in the order it was given them.
 *
 * @param res - The fake response.
 * @returns One name and value per `setHeader` call.
 */
const lines = (res: FakeResponse): unknown[][] =>
  res.calls.filter(([method]) => method === 'setHeader').map(([, name, value]) => [name, value])

/**
 * Finds the `Content-Length` a fake response was given.
 *
 * @param res - The fake response.
 * @returns The value, or `undefined` when no such line was set.
 */
const lengthLine = (res: FakeResponse): unknown => lines(res).find(([name]) => name === 'Content-Length')?.[1]

/**
 * Lists the methods called on a fake response, without their arguments.
 *
 * @param res - The fake response.
 * @returns The method names in call order, header lines left out.
 */
const steps = (res: FakeResponse): unknown[] => res.calls.map(([method]) => method).filter((method) => method !== 'setHeader')

/**
 * Measures what was handed to `write` and `end`.
 *
 * @param res - The fake response.
 * @returns One entry per call: the method and the byte length it was given, `0` for an `end` without bytes.
 */
const sizes = (res: FakeResponse): unknown[][] =>
  res.calls
    .filter(([method]) => method === 'write' || method === 'end')
    .map(([method, chunk]) => [method, (chunk as Uint8Array | undefined)?.length ?? 0])

describe('writeResponse head', () => {
  it('writes the status', () => {
    const harness = start()
    void harness.write({ status: 201, headers: {}, body: null })
    expect(harness.res.calls).toContainEqual(['writeHead', 201])
  })

  it('writes the headers as they are spelled, in the order given, before the length', () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'X-One': '1', 'x-two': '2' }, body: null })
    expect(lines(harness.res)).toEqual([
      ['X-One', '1'],
      ['x-two', '2'],
      ['Content-Length', '0'],
    ])
  })

  it('sets every header before it writes the head', () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'X-One': '1' }, body: null })
    expect(harness.res.calls.map(([method]) => method)).toEqual(['setHeader', 'setHeader', 'writeHead', 'end'])
  })

  it('writes one cookie line per cookie', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, cookies: ['a=1', 'b=2'], body: null })
    expect(lines(harness.res)).toContainEqual(['Set-Cookie', ['a=1', 'b=2']])
  })

  it('writes a Set-Cookie header first among the cookies, after the other headers', () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'set-cookie': 'a=1', 'X-One': '1' }, cookies: ['b=2', 'c=3'], body: null })
    expect(lines(harness.res)).toEqual([
      ['X-One', '1'],
      ['Set-Cookie', ['a=1', 'b=2', 'c=3']],
      ['Content-Length', '0'],
    ])
  })

  it('writes a Set-Cookie header that comes without cookies', () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'Set-Cookie': 'a=1' }, body: null })
    expect(lines(harness.res)).toContainEqual(['Set-Cookie', ['a=1']])
  })

  it('writes no cookie line for an empty list of cookies', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, cookies: [], body: null })
    expect(lines(harness.res)).toEqual([['Content-Length', '0']])
  })

  it('closes the connection while the service drains', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: null }, true)
    expect(lines(harness.res)).toEqual([
      ['Content-Length', '0'],
      ['Connection', 'close'],
    ])
  })

  it('closes the connection when the request has not been received completely', () => {
    const harness = start({ complete: false })
    void harness.write({ status: 401, headers: {}, body: null })
    expect(lines(harness.res)).toContainEqual(['Connection', 'close'])
  })

  it('notes the status on the exchange', () => {
    const harness = start()
    void harness.write({ status: 418, headers: {}, body: null })
    expect(harness.exchange.status).toBe(418)
  })

  it('reads whether the shutdown closes the connection when the head is written, not before', async () => {
    const harness = start()
    const body = new PassThrough()
    const state = { draining: false }
    void writeResponse(
      harness.exchange,
      { status: 200, headers: {}, body },
      { writeIdleTimeoutMs: 30000 },
      harness.clock,
      () => state.draining
    )
    state.draining = true
    body.end('late')
    await flushPromises()
    expect(lines(harness.res)).toEqual([['Connection', 'close']])
  })
})

describe('writeResponse content length', () => {
  it('sends the byte length of a buffer', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.from('héllo') })
    expect(lengthLine(harness.res)).toBe('6')
  })

  it('replaces a declared length that disagrees with the buffer', () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'content-length': '99' }, body: Buffer.from('four') })
    expect(lines(harness.res)).toEqual([['Content-Length', '4']])
  })

  it('sends none for a 204 without a body', () => {
    const harness = start()
    void harness.write({ status: 204, headers: { 'Content-Length': '7' }, body: null })
    expect(lines(harness.res)).toEqual([])
  })

  it('sends the declared length for a HEAD request without a body', () => {
    const harness = start({ method: 'HEAD' })
    void harness.write({ status: 200, headers: { 'Content-Length': '1234' }, body: null })
    expect(lengthLine(harness.res)).toBe('1234')
  })

  it('sends none for a HEAD request without a body that declares none', () => {
    const harness = start({ method: 'HEAD' })
    void harness.write({ status: 200, headers: {}, body: null })
    expect(lines(harness.res)).toEqual([])
  })

  it('sends the declared length for a 304 without a body', () => {
    const harness = start()
    void harness.write({ status: 304, headers: { 'CONTENT-LENGTH': '88' }, body: null })
    expect(lines(harness.res)).toEqual([['Content-Length', '88']])
  })

  it('sends none for a 304 without a body that declares none', () => {
    const harness = start()
    void harness.write({ status: 304, headers: {}, body: null })
    expect(lines(harness.res)).toEqual([])
  })

  it('sends 0 for any other response without a body', () => {
    const harness = start()
    void harness.write({ status: 404, headers: { 'Content-Length': '12' }, body: null })
    expect(lines(harness.res)).toEqual([['Content-Length', '0']])
  })

  it('sends the declared length of a stream', async () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'Content-Length': '5' }, body: Readable.from([Buffer.from('hello')]) })
    await flushPromises()
    expect(lines(harness.res)).toEqual([['Content-Length', '5']])
  })

  it('sends none for a stream that declares none, so the body goes out chunked', async () => {
    const harness = start()
    void harness.write({ status: 200, headers: { 'X-One': '1' }, body: Readable.from([Buffer.from('hello')]) })
    await flushPromises()
    expect(lines(harness.res)).toEqual([['X-One', '1']])
  })
})

describe('writeResponse bodiless', () => {
  it('writes no bytes of a buffer for a HEAD request', () => {
    const harness = start({ method: 'HEAD' })
    void harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    expect(sizes(harness.res)).toEqual([['end', 0]])
  })

  it('still sends the length of a buffer for a HEAD request', () => {
    const harness = start({ method: 'HEAD' })
    void harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    expect(lengthLine(harness.res)).toBe('5')
  })

  it('releases a stream for a HEAD request', () => {
    const harness = start({ method: 'HEAD' })
    const body = new PassThrough()
    void harness.write({ status: 200, headers: {}, body })
    expect(body.destroyed).toBe(true)
  })

  it('keeps the declared length of a stream for a HEAD request', () => {
    const harness = start({ method: 'HEAD' })
    void harness.write({ status: 200, headers: { 'Content-Length': '500' }, body: new PassThrough() })
    expect(lengthLine(harness.res)).toBe('500')
  })

  it('writes nothing of a stream for a HEAD request', async () => {
    const harness = start({ method: 'HEAD' })
    const body = new PassThrough()
    body.write('never sent')
    void harness.write({ status: 200, headers: {}, body })
    await flushPromises()
    expect(steps(harness.res)).toEqual(['writeHead', 'end'])
  })

  it('writes neither the bytes nor the length of a buffer on a 204', () => {
    const harness = start()
    void harness.write({ status: 204, headers: {}, body: Buffer.from('hello') })
    expect({ lines: lines(harness.res), sizes: sizes(harness.res) }).toEqual({ lines: [], sizes: [['end', 0]] })
  })

  it('releases a stream on a 204', () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write({ status: 204, headers: {}, body })
    expect(body.destroyed).toBe(true)
  })

  it('drops the declared length of a stream on a 204', () => {
    const harness = start()
    void harness.write({ status: 204, headers: { 'Content-Length': '500' }, body: new PassThrough() })
    expect(lines(harness.res)).toEqual([])
  })

  it('sends the length of a buffer on a 304 without its bytes', () => {
    const harness = start()
    void harness.write({ status: 304, headers: {}, body: Buffer.from('hello') })
    expect({ length: lengthLine(harness.res), sizes: sizes(harness.res) }).toEqual({ length: '5', sizes: [['end', 0]] })
  })

  it('releases a stream on a 304', () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write({ status: 304, headers: {}, body })
    expect(body.destroyed).toBe(true)
  })

  it('keeps the declared length of a stream on a 304', () => {
    const harness = start()
    void harness.write({ status: 304, headers: { 'Content-Length': '500' }, body: new PassThrough() })
    expect(lengthLine(harness.res)).toBe('500')
  })

  it('settles the outcome as sent once a bodiless response is flushed', async () => {
    const harness = start({ method: 'HEAD' })
    const written = harness.write({ status: 200, headers: {}, body: new PassThrough() })
    harness.finish()
    await written
    expect(harness.exchange.outcome).toBe('sent')
  })

  it('leaves the signal alone when a HEAD request released a stream', async () => {
    const harness = start({ method: 'HEAD' })
    const written = harness.write({ status: 200, headers: {}, body: new PassThrough() })
    harness.finish()
    await written
    expect(harness.exchange.context.signal.aborted).toBe(false)
  })
})

describe('writeResponse buffer', () => {
  it('ends once with a body of exactly one slice', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE, 0x61) })
    expect(sizes(harness.res)).toEqual([['end', SLICE]])
  })

  it('ends once with a body under one slice', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    expect(harness.res.calls.at(-1)).toEqual(['end', Buffer.from('hello')])
  })

  it('ends with no bytes for an empty buffer', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(0) })
    expect(sizes(harness.res)).toEqual([['end', 0]])
  })

  it('writes a larger body in slices and ends with the last one', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })
    expect(sizes(harness.res)).toEqual([
      ['write', SLICE],
      ['write', SLICE],
      ['end', 10],
    ])
  })

  it('ends with a whole slice when the body is an exact number of slices', () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2, 0x61) })
    expect(sizes(harness.res)).toEqual([
      ['write', SLICE],
      ['end', SLICE],
    ])
  })

  it('writes every byte in order without copying the body', () => {
    const harness = start()
    const body = Buffer.concat([Buffer.alloc(SLICE, 0x61), Buffer.alloc(SLICE, 0x62), Buffer.from('tail')])
    void harness.write({ status: 200, headers: {}, body })
    expect(
      Buffer.concat(
        harness.res.calls.filter(([method]) => method === 'write' || method === 'end').map(([, chunk]) => chunk as Uint8Array)
      ).equals(body)
    ).toBe(true)
  })

  it('waits for drain after a write the response did not take', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })
    await flushPromises()
    expect(sizes(harness.res)).toEqual([['write', SLICE]])
  })

  it('goes on with the next slice at drain', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })
    harness.res.emit('drain')
    await flushPromises()
    expect(sizes(harness.res)).toEqual([
      ['write', SLICE],
      ['write', SLICE],
      ['end', 10],
    ])
  })

  it('waits again after each write the response did not take', async () => {
    const harness = start()
    harness.res.accepts.push(false, false)
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })
    harness.res.emit('drain')
    await flushPromises()
    expect(sizes(harness.res)).toEqual([
      ['write', SLICE],
      ['write', SLICE],
    ])
  })

  it('writes no further slice when the exchange got its outcome between the drain and the next write', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    void harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })
    harness.res.emit('drain')
    harness.exchange.settleOutcome('shutdown')
    await flushPromises()
    expect(sizes(harness.res)).toEqual([['write', SLICE]])
  })

  it('has no outcome before the response is flushed', async () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    await flushPromises()
    expect(harness.exchange.outcome).toBeNull()
  })

  it('settles the outcome as sent at finish, before the response closes', async () => {
    const harness = start()
    void harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    harness.res.emit('finish')
    await flushPromises()
    expect({ outcome: harness.exchange.outcome, ended: harness.exchange.ended }).toEqual({ outcome: 'sent', ended: false })
  })

  it('resolves once the response is flushed', async () => {
    const harness = start()
    const written = harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    harness.finish()
    expect(await written).toBeUndefined()
  })

  it('reports the request as sent with its status', async () => {
    const harness = start()
    const written = harness.write({ status: 200, headers: {}, body: Buffer.from('hello') })
    harness.finish()
    await written
    expect(harness.events).toEqual([expect.objectContaining({ type: 'request', status: 200, outcome: 'sent' })])
  })

  it('leaves no listener on the response once it is flushed', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    const written = harness.write({ status: 200, headers: {}, body: Buffer.alloc(SLICE + 1, 0x61) })
    harness.res.emit('drain')
    await flushPromises()
    harness.finish()
    await written
    expect({ drain: harness.res.listenerCount('drain'), finish: harness.res.listenerCount('finish') }).toEqual({ drain: 0, finish: 0 })
  })
})

describe('writeResponse end callbacks', () => {
  /**
   * Starts an exchange whose `onEnd` counts the callbacks that are registered and not yet taken back.
   *
   * @returns The harness, a view of its exchange that counts, and the count.
   */
  const counting = (): Harness & { counted: Exchange; pending: () => number } => {
    const harness = start()
    const state = { pending: 0 }
    const onEnd = (callback: () => void): (() => void) => {
      state.pending += 1
      const forget = harness.exchange.onEnd(callback)
      return () => {
        state.pending -= 1
        forget()
      }
    }
    return { ...harness, counted: Object.create(harness.exchange, { onEnd: { value: onEnd } }) as Exchange, pending: () => state.pending }
  }

  it('holds one end callback while it waits', () => {
    const { counted, clock, pending } = counting()
    void writeResponse(counted, { status: 200, headers: {}, body: Buffer.from('hello') }, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    expect(pending()).toBe(1)
  })

  it('takes its end callback back after every wait of a buffer, so a long transfer gathers none', async () => {
    const { counted, clock, res, pending } = counting()
    res.accepts.push(false, false)
    void writeResponse(
      counted,
      { status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) },
      { writeIdleTimeoutMs: 30000 },
      clock,
      () => false
    )
    res.emit('drain')
    await flushPromises()
    res.emit('drain')
    await flushPromises()
    res.emit('finish')
    expect(pending()).toBe(0)
  })

  it('takes its end callback back at a stall', () => {
    const { counted, clock, timers, pending } = counting()
    void writeResponse(counted, { status: 200, headers: {}, body: Buffer.from('hello') }, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    timers[0]?.callback()
    expect(pending()).toBe(0)
  })

  it('holds one end callback while it waits for the chunks of a stream', async () => {
    const { counted, clock, pending } = counting()
    const body = new PassThrough()
    void writeResponse(counted, { status: 200, headers: {}, body }, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    body.write('hello')
    await flushPromises()
    expect(pending()).toBe(1)
  })

  it('takes its end callbacks back when a stream response is flushed', async () => {
    const { counted, clock, res, pending } = counting()
    res.accepts.push(false)
    const body = new PassThrough()
    void writeResponse(counted, { status: 200, headers: {}, body }, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    body.write('hello')
    await flushPromises()
    res.emit('drain')
    body.end()
    await flushPromises()
    res.emit('finish')
    expect(pending()).toBe(0)
  })

  it('takes its end callback back when a chunk throws', async () => {
    const { counted, clock, res, pending } = counting()
    Object.assign(res, {
      write: () => {
        throw new Error('write failed')
      },
    })
    const body = new PassThrough()
    const written = writeResponse(counted, { status: 200, headers: {}, body }, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    body.write('hello')
    await written
    expect(pending()).toBe(0)
  })
})
