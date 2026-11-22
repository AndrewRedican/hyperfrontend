import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServiceResponse } from './contract'
import type { FailureEvent, RequestEvent, ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
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

/** The fake response: it records every call, answers a write as a spec tells it to, and throws where a spec asks for it. */
interface FakeResponse extends EventEmitter {
  /** The socket the response writes to, or `null` while it is queued behind an earlier response. */
  socket: unknown
  /** Whether the response has been flushed. */
  writableFinished: boolean
  /** Every call that did not throw, in order: the method, then its arguments. */
  readonly calls: unknown[][]
  /** What the next calls of `write` return; `true` once the list is empty. */
  readonly accepts: boolean[]
  /** Methods whose next call throws, one entry per throw. */
  readonly failing: string[]
  /** Takes one chunk; a spec may replace it. */
  write(chunk: Uint8Array): boolean
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
  /** Writes a response for the exchange. */
  write(response: ServiceResponse): Promise<void>
  /** Flushes the fake response and closes it, as Node does after the last byte. */
  finish(): void
}

const SLICE = 65536
const IDLE = 30000
const SMALL: ServiceResponse = { status: 200, headers: { 'X-One': '1' }, cookies: ['a=1'], body: Buffer.from('hello') }
const LISTENED = ['data', 'end', 'error', 'close'] as const
// note: What a stream is left with once the writer let go of it: the kernel's one error listener and nothing else.
const KERNEL_ONLY = [0, 0, 1, 0]

/**
 * Builds a buffer response larger than two slices, so a write that is not taken leaves more to send.
 *
 * @returns The response.
 */
const large = (): ServiceResponse => ({ status: 200, headers: {}, body: Buffer.alloc(SLICE * 2 + 10, 0x61) })

/**
 * Starts a `GET` exchange over a fake request, response, socket and clock.
 *
 * @param queued - Whether the response is still queued behind an earlier one, so that it has no socket.
 * @returns The exchange and its surroundings.
 */
const start = (queued = false): Harness => {
  const socket = Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    destroyed: 0,
    destroy: () => void (socket.destroyed += 1),
  })
  const req = Object.assign(new PassThrough(), { method: 'GET', url: '/', headers: {}, complete: true, socket })
  const calls: unknown[][] = []
  const accepts: boolean[] = []
  const failing: string[] = []
  const set = new Set<string>()
  const record = (method: string, ...given: unknown[]): void => {
    if (failing.includes(method)) {
      failing.splice(failing.indexOf(method), 1)
      throw new Error(`${method} failed`)
    }
    calls.push([method, ...given])
  }
  const res: FakeResponse = Object.assign(new EventEmitter(), {
    socket: (queued ? null : socket) as unknown,
    writableFinished: false,
    calls,
    accepts,
    failing,
    setHeader: (name: string, value: unknown) => {
      record('setHeader', name, value)
      set.add(name)
    },
    getHeaderNames: () => [...set],
    removeHeader: (name: string) => {
      record('removeHeader', name)
      set.delete(name)
    },
    writeHead: (status: number) => record('writeHead', status, [...set]),
    write: (chunk: Uint8Array) => {
      record('write', chunk)
      return accepts.shift() ?? true
    },
    end: (...chunk: Uint8Array[]) => record('end', ...chunk),
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
    write: (response) => writeResponse(exchange, response, { writeIdleTimeoutMs: IDLE }, clock, () => false),
    finish: () => {
      res.writableFinished = true
      res.emit('finish')
      res.emit('close')
    },
  }
}

/**
 * Lists the methods called on a fake response, without their arguments.
 *
 * @param res - The fake response.
 * @returns The method names in call order, header lines left out.
 */
const steps = (res: FakeResponse): unknown[] =>
  res.calls.map(([method]) => method).filter((method) => method !== 'setHeader' && method !== 'removeHeader')

/**
 * Lists the heads a fake response wrote.
 *
 * @param res - The fake response.
 * @returns One entry per `writeHead` call: the status and the names of the headers set at that moment.
 */
const heads = (res: FakeResponse): unknown[][] =>
  res.calls.filter(([method]) => method === 'writeHead').map(([, status, names]) => [status, names])

/**
 * Picks the failure events out of what a sink received.
 *
 * @param events - Every event of a harness.
 * @returns The failure events, reduced to their code and name.
 */
const failures = (events: readonly ServiceEvent[]): unknown[] =>
  events.filter((event): event is FailureEvent => event.type === 'failure').map(({ code, name }) => ({ code, name }))

/**
 * Starts a large buffer response whose first slice the response does not take, so the writer waits for drain.
 *
 * @param queued - Whether the response is still queued behind an earlier one.
 * @returns The harness and the pending write.
 */
const waiting = (queued = false): Harness & { written: Promise<void> } => {
  const harness = start(queued)
  harness.res.accepts.push(false)
  return { ...harness, written: harness.write(large()) }
}

/**
 * Starts a stream response whose first chunk the response does not take, so the writer waits for drain with the stream paused.
 *
 * @returns The harness, the stream and the pending write.
 */
const streaming = async (): Promise<Harness & { body: PassThrough; written: Promise<void> }> => {
  const harness = start()
  harness.res.accepts.push(false)
  const body = new PassThrough()
  const written = harness.write({ status: 200, headers: {}, body })
  body.write('hello')
  await flushPromises()
  return { ...harness, body, written }
}

describe('writeResponse stall', () => {
  it('bounds a wait for drain by the write idle timeout', () => {
    expect(waiting().timers.map(({ ms, cleared }) => ({ ms, cleared }))).toEqual([{ ms: IDLE, cleared: false }])
  })

  it('bounds the wait for finish by the write idle timeout', () => {
    const harness = start()
    void harness.write(SMALL)
    expect(harness.timers.map(({ ms, cleared }) => ({ ms, cleared }))).toEqual([{ ms: IDLE, cleared: false }])
  })

  it('destroys the socket when no drain arrives within the timeout', () => {
    const { socket, timers } = waiting()
    timers[0]?.callback()
    expect(socket.destroyed).toBe(1)
  })

  it('settles the outcome as a stalled write', () => {
    const { exchange, timers } = waiting()
    timers[0]?.callback()
    expect(exchange.outcome).toBe('write-stalled')
  })

  it('aborts the signal at a stall', () => {
    const { exchange, timers } = waiting()
    timers[0]?.callback()
    expect(exchange.context.signal.aborted).toBe(true)
  })

  it('writes nothing more after a stall', async () => {
    const { res, timers } = waiting()
    timers[0]?.callback()
    await flushPromises()
    expect(steps(res)).toEqual(['writeHead', 'write'])
  })

  it('resolves after a stall', async () => {
    const { timers, written } = waiting()
    timers[0]?.callback()
    expect(await written).toBeUndefined()
  })

  it('reports no failure for a stall', async () => {
    const { events, timers, written } = waiting()
    timers[0]?.callback()
    await written
    expect(events).toEqual([])
  })

  it('stops listening for drain after a stall', () => {
    const { res, timers } = waiting()
    timers[0]?.callback()
    expect(res.listenerCount('drain')).toBe(0)
  })

  it('cuts a response that is not flushed within the timeout', () => {
    const harness = start()
    void harness.write(SMALL)
    harness.timers[0]?.callback()
    expect({ outcome: harness.exchange.outcome, destroyed: harness.socket.destroyed }).toEqual({ outcome: 'write-stalled', destroyed: 1 })
  })

  it('releases a stream body at a stall', async () => {
    const { body, timers, written } = await streaming()
    timers[0]?.callback()
    await written
    expect(body.destroyed).toBe(true)
  })

  it('reports no failure for the stream it released at a stall', async () => {
    const { events, timers, written } = await streaming()
    timers[0]?.callback()
    await written
    await flushPromises()
    expect(events).toEqual([])
  })

  it('leaves none of its listeners on a stream released at a stall', async () => {
    const { body, timers, written } = await streaming()
    timers[0]?.callback()
    await written
    expect(LISTENED.map((event) => body.listenerCount(event))).toEqual(KERNEL_ONLY)
  })

  it('clears the timer at drain', () => {
    const { res, timers } = waiting()
    res.emit('drain')
    expect(timers[0]?.cleared).toBe(true)
  })

  it('clears the timer at finish', () => {
    const harness = start()
    void harness.write(SMALL)
    harness.res.emit('finish')
    expect(harness.timers[0]?.cleared).toBe(true)
  })

  it('starts a new timer for each wait', async () => {
    const { res, timers } = waiting()
    res.emit('drain')
    await flushPromises()
    expect(timers.map(({ cleared }) => cleared)).toEqual([true, false])
  })

  it('starts the timer again when it fires while the response is queued behind an earlier one', () => {
    const { timers } = waiting(true)
    timers[0]?.callback()
    expect(timers.map(({ ms }) => ms)).toEqual([IDLE, IDLE])
  })

  it('cuts nothing while the response is queued', () => {
    const { exchange, socket, timers } = waiting(true)
    timers[0]?.callback()
    timers[1]?.callback()
    timers[2]?.callback()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed }).toEqual({ outcome: null, destroyed: 0 })
  })

  it('still ends a queued wait at drain', async () => {
    const { res, timers } = waiting(true)
    timers[0]?.callback()
    res.emit('drain')
    await flushPromises()
    expect({ cleared: timers[1]?.cleared, steps: steps(res) }).toEqual({ cleared: true, steps: ['writeHead', 'write', 'write', 'end'] })
  })

  it('cuts nothing when the timer fires on a response that has no socket any more', () => {
    const { exchange, res, socket, timers } = waiting()
    res.socket = null
    timers[0]?.callback()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed, timers: timers.length }).toEqual({
      outcome: null,
      destroyed: 0,
      timers: 2,
    })
  })

  it('gives a response that got its socket in the middle of a period one whole period more', () => {
    const { exchange, res, socket, timers } = waiting(true)
    timers[0]?.callback()
    res.socket = socket
    timers[1]?.callback()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed, timers: timers.length }).toEqual({
      outcome: null,
      destroyed: 0,
      timers: 3,
    })
  })

  it('cuts a response once it held its socket through a whole period', () => {
    const { exchange, res, socket, timers } = waiting(true)
    timers[0]?.callback()
    res.socket = socket
    timers[1]?.callback()
    timers[2]?.callback()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed }).toEqual({ outcome: 'write-stalled', destroyed: 1 })
  })
})

describe('writeResponse abort', () => {
  it('ends a wait when the exchange ends', async () => {
    const { res, written } = waiting()
    res.emit('close')
    expect(await written).toBeUndefined()
  })

  it('clears the timer when the exchange ends', () => {
    const { res, timers } = waiting()
    res.emit('close')
    expect(timers[0]?.cleared).toBe(true)
  })

  it('stops listening to the response when the exchange ends', () => {
    const { res } = waiting()
    res.emit('close')
    expect(res.listenerCount('drain')).toBe(0)
  })

  it('writes nothing more once the exchange ended', async () => {
    const { res, written } = waiting()
    res.emit('close')
    await written
    expect(steps(res)).toEqual(['writeHead', 'write'])
  })

  it('leaves the outcome of a client that left to the exchange', async () => {
    const { events, socket, written } = waiting()
    socket.emit('close')
    await written
    expect(events).toEqual([expect.objectContaining({ type: 'request', status: 200, outcome: 'client-closed' })])
  })

  it('does not settle a response as sent when the exchange ended before its finish', async () => {
    const harness = start()
    const written = harness.write(SMALL)
    harness.res.emit('close')
    await written
    expect(harness.exchange.outcome).toBe('client-closed')
  })

  it('releases a stream when the exchange ends while its first chunk is awaited', async () => {
    const harness = start()
    const body = new PassThrough()
    const written = harness.write({ status: 200, headers: {}, body })
    harness.res.emit('close')
    await written
    expect(body.destroyed).toBe(true)
  })

  it('reports a client that left before the head with status 0', async () => {
    const harness = start()
    const written = harness.write({ status: 200, headers: {}, body: new PassThrough() })
    harness.socket.emit('close')
    await written
    await flushPromises()
    expect(harness.events).toEqual([expect.objectContaining({ type: 'request', status: 0, outcome: 'client-closed' })])
  })

  it('leaves none of its listeners on a stream when the exchange ends', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write({ status: 200, headers: {}, body })
    harness.res.emit('close')
    expect(LISTENED.map((event) => body.listenerCount(event))).toEqual(KERNEL_ONLY)
  })

  it('releases a paused stream when the exchange ends during its wait for drain', async () => {
    const { body, res, written } = await streaming()
    res.emit('close')
    await written
    expect(body.destroyed).toBe(true)
  })

  it('releases a response that arrives after the exchange ended', async () => {
    const harness = start()
    harness.res.emit('close')
    const body = new PassThrough()
    await harness.write({ status: 200, headers: {}, body })
    expect({ released: body.destroyed, calls: harness.res.calls }).toEqual({ released: true, calls: [] })
  })

  it('releases a response that arrives after the exchange got its outcome', async () => {
    const harness = start()
    harness.exchange.settleOutcome('request-timeout')
    const body = new PassThrough()
    await harness.write({ status: 200, headers: {}, body })
    expect({ released: body.destroyed, calls: harness.res.calls }).toEqual({ released: true, calls: [] })
  })

  it('writes nothing of a buffer that arrives after the exchange got its outcome', async () => {
    const harness = start()
    harness.exchange.settleOutcome('shutdown')
    await harness.write(SMALL)
    expect(harness.res.calls).toEqual([])
  })

  it('writes no chunk that arrives after the exchange got its outcome', async () => {
    const harness = start()
    const body = new PassThrough()
    const written = harness.write({ status: 200, headers: {}, body })
    harness.exchange.settleOutcome('request-timeout')
    body.write('late')
    await written
    expect({ released: body.destroyed, calls: harness.res.calls, status: harness.exchange.status }).toEqual({
      released: true,
      calls: [],
      status: 0,
    })
  })

  it('writes no head for a stream that ends after the exchange got its outcome', async () => {
    const harness = start()
    const body = new PassThrough()
    const written = harness.write({ status: 200, headers: {}, body })
    harness.exchange.settleOutcome('request-timeout')
    body.end()
    await written
    expect(harness.res.calls).toEqual([])
  })

  it('does not resume a stream whose exchange got its outcome between the drain and the next chunk', async () => {
    const { exchange, body, res, written } = await streaming()
    res.emit('drain')
    exchange.settleOutcome('shutdown')
    await written
    expect(body.destroyed).toBe(true)
  })
})

describe('writeResponse last resort', () => {
  it('reports a head that could not be written, once', async () => {
    const harness = start()
    harness.res.failing.push('writeHead')
    void harness.write(SMALL)
    await flushPromises()
    expect(failures(harness.events)).toEqual([{ code: 'write-failed', name: 'Error' }])
  })

  it('sends the plain 500 in its place, without the headers and cookies set for the response that failed', async () => {
    const harness = start()
    harness.res.failing.push('writeHead')
    void harness.write(SMALL)
    await flushPromises()
    expect(heads(harness.res)).toEqual([[500, ['Content-Type', 'Cache-Control', 'Content-Length']]])
  })

  it('ends the 500 with its reason phrase', async () => {
    const harness = start()
    harness.res.failing.push('writeHead')
    void harness.write(SMALL)
    await flushPromises()
    expect(harness.res.calls.at(-1)).toEqual(['end', Buffer.from('Internal Server Error')])
  })

  it('annotates the request as an internal failure that was sent', async () => {
    const harness = start()
    harness.res.failing.push('writeHead')
    const written = harness.write(SMALL)
    await flushPromises()
    harness.finish()
    await written
    expect(harness.events.filter((event): event is RequestEvent => event.type === 'request')).toEqual([
      expect.objectContaining({ status: 500, outcome: 'sent', annotations: { failure: 'internal' } }),
    ])
  })

  it('answers a header that could not be set the same way', async () => {
    const harness = start()
    harness.res.failing.push('setHeader')
    void harness.write(SMALL)
    await flushPromises()
    expect(heads(harness.res)).toEqual([[500, ['Content-Type', 'Cache-Control', 'Content-Length']]])
  })

  it('releases a stream whose head could not be written', async () => {
    const harness = start()
    harness.res.failing.push('writeHead')
    const body = new PassThrough()
    void harness.write({ status: 200, headers: {}, body })
    body.write('hello')
    await flushPromises()
    expect({ released: body.destroyed, heads: heads(harness.res) }).toEqual({
      released: true,
      heads: [[500, ['Content-Type', 'Cache-Control', 'Content-Length']]],
    })
  })

  it('destroys the socket when the 500 cannot be written either', async () => {
    const harness = start()
    harness.res.failing.push('writeHead', 'writeHead')
    await harness.write(SMALL)
    expect({ outcome: harness.exchange.outcome, destroyed: harness.socket.destroyed }).toEqual({ outcome: 'write-failed', destroyed: 1 })
  })

  it('reports once when the 500 cannot be written either', async () => {
    const harness = start()
    harness.res.failing.push('writeHead', 'writeHead')
    await harness.write(SMALL)
    expect(failures(harness.events)).toEqual([{ code: 'write-failed', name: 'Error' }])
  })

  it('destroys the socket when the 500 has its head out and cannot be ended', async () => {
    const harness = start()
    harness.res.failing.push('writeHead', 'end')
    await harness.write(SMALL)
    expect({ outcome: harness.exchange.outcome, destroyed: harness.socket.destroyed, heads: heads(harness.res).length }).toEqual({
      outcome: 'write-failed',
      destroyed: 1,
      heads: 1,
    })
  })

  it('destroys the socket when a slice throws after the head', async () => {
    const harness = start()
    harness.res.failing.push('write')
    await harness.write(large())
    expect({ outcome: harness.exchange.outcome, destroyed: harness.socket.destroyed }).toEqual({ outcome: 'write-failed', destroyed: 1 })
  })

  it('writes no 500 after a head', async () => {
    const harness = start()
    harness.res.failing.push('write')
    await harness.write(large())
    expect({ steps: steps(harness.res), failures: failures(harness.events) }).toEqual({
      steps: ['writeHead'],
      failures: [{ code: 'write-failed', name: 'Error' }],
    })
  })

  it('destroys the socket when the end throws after the head', async () => {
    const harness = start()
    harness.res.failing.push('end')
    await harness.write(SMALL)
    expect({ outcome: harness.exchange.outcome, destroyed: harness.socket.destroyed }).toEqual({ outcome: 'write-failed', destroyed: 1 })
  })

  it('destroys the socket and releases the stream when a chunk throws', async () => {
    const harness = start()
    harness.res.failing.push('write')
    const body = new PassThrough()
    const written = harness.write({ status: 200, headers: {}, body })
    body.write('hello')
    await written
    expect({
      outcome: harness.exchange.outcome,
      destroyed: harness.socket.destroyed,
      released: body.destroyed,
      failures: failures(harness.events),
    }).toEqual({
      outcome: 'write-failed',
      destroyed: 1,
      released: true,
      failures: [{ code: 'write-failed', name: 'Error' }],
    })
  })

  it('leaves none of its listeners on a stream whose chunk threw', async () => {
    const harness = start()
    harness.res.failing.push('write')
    const body = new PassThrough()
    const written = harness.write({ status: 200, headers: {}, body })
    body.write('hello')
    await written
    expect(LISTENED.map((event) => body.listenerCount(event))).toEqual(KERNEL_ONLY)
  })

  it('neither reports nor answers a throw that follows an outcome', async () => {
    const harness = start()
    harness.res.write = () => {
      harness.exchange.settleOutcome('shutdown')
      throw new Error('late')
    }
    await harness.write(large())
    expect({ events: harness.events, destroyed: harness.socket.destroyed, steps: steps(harness.res) }).toEqual({
      events: [],
      destroyed: 0,
      steps: ['writeHead'],
    })
  })

  it('never rejects', async () => {
    const harness = start()
    harness.res.failing.push('writeHead', 'setHeader')
    expect(await harness.write(SMALL)).toBeUndefined()
  })
})
