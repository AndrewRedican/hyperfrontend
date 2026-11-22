import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServiceResponse } from './contract'
import type { FailureEvent, RequestEvent, ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough, Readable } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createExchange } from './exchange'
import { writeResponse } from './response-writer'

/** The fake response: it records every call and answers a write as a spec tells it to. */
interface FakeResponse extends EventEmitter {
  /** The socket the response writes to. */
  socket: unknown
  /** Whether the response has been flushed. */
  writableFinished: boolean
  /** Every call in order: the method, then its arguments. */
  readonly calls: unknown[][]
  /** What the next calls of `write` return; `true` once the list is empty. */
  readonly accepts: boolean[]
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
  /** Writes a response with a stream body for the exchange. */
  write(body: Readable, headers?: Readonly<Record<string, string>>): Promise<void>
  /** Flushes the fake response and closes it, as Node does after the last byte. */
  finish(): void
}

const LISTENED = ['data', 'end', 'error', 'close'] as const
// note: What a stream is left with once the writer let go of it: the kernel's one error listener and nothing else.
const KERNEL_ONLY = [0, 0, 1, 0]

/**
 * Starts a `GET` exchange over a fake request, response, socket and clock.
 *
 * @returns The exchange and its surroundings.
 */
const start = (): Harness => {
  const socket = Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    destroyed: 0,
    destroy: () => void (socket.destroyed += 1),
  })
  const req = Object.assign(new PassThrough(), { method: 'GET', url: '/files/report', headers: {}, complete: true, socket })
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
  const clock = { now: () => 0, setTimeout: () => undefined, clearTimeout: () => undefined }
  const exchange = createExchange(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    { bodyBytes: 65536, trustedProxyHops: 0 },
    clock,
    (event) => void events.push(event),
    false
  )
  return {
    exchange,
    res,
    socket,
    events,
    write: (body, headers = {}) => {
      const response: ServiceResponse = { status: 200, headers, body }
      return writeResponse(exchange, response, { writeIdleTimeoutMs: 30000 }, clock, () => false)
    },
    finish: () => {
      res.writableFinished = true
      res.emit('finish')
      res.emit('close')
    },
  }
}

/**
 * Builds a stream that hands on whatever it is given, unconverted.
 *
 * @returns An object-mode stream a spec pushes chunks into.
 */
const objects = (): Readable => new Readable({ objectMode: true, read: () => undefined })

/**
 * Lists the methods called on a fake response, without their arguments.
 *
 * @param res - The fake response.
 * @returns The method names in call order, header lines left out.
 */
const steps = (res: FakeResponse): unknown[] => res.calls.map(([method]) => method).filter((method) => method !== 'setHeader')

/**
 * Lists the header lines a fake response was given.
 *
 * @param res - The fake response.
 * @returns One name and value per `setHeader` call.
 */
const lines = (res: FakeResponse): unknown[][] =>
  res.calls.filter(([method]) => method === 'setHeader').map(([, name, value]) => [name, value])

/**
 * Lists the statuses a fake response wrote a head with.
 *
 * @param res - The fake response.
 * @returns One status per `writeHead` call.
 */
const heads = (res: FakeResponse): unknown[] => res.calls.filter(([method]) => method === 'writeHead').map(([, status]) => status)

/**
 * Joins the bytes a fake response was handed.
 *
 * @param res - The fake response.
 * @returns What `write` and `end` received, as UTF-8 text.
 */
const text = (res: FakeResponse): string =>
  Buffer.concat(
    res.calls
      .filter(([method, chunk]) => (method === 'write' || method === 'end') && chunk !== undefined)
      .map(([, chunk]) => chunk as Uint8Array)
  ).toString('utf8')

/**
 * Picks the failure events out of what a sink received.
 *
 * @param events - Every event of a harness.
 * @returns The failure events, reduced to their code and name.
 */
const failures = (events: readonly ServiceEvent[]): unknown[] =>
  events.filter((event): event is FailureEvent => event.type === 'failure').map(({ code, name }) => ({ code, name }))

/**
 * Counts the listeners a stream has for the events the writer listens to.
 *
 * @param body - The stream.
 * @returns One count per event.
 */
const listeners = (body: Readable): number[] => LISTENED.map((event) => body.listenerCount(event))

/**
 * Starts a stream response and lets its first chunk go out.
 *
 * @param headers - The headers of the response.
 * @returns The harness and the stream, one chunk of five bytes written.
 */
const underway = async (
  headers: Readonly<Record<string, string>> = {}
): Promise<Harness & { body: PassThrough; written: Promise<void> }> => {
  const harness = start()
  const body = new PassThrough()
  const written = harness.write(body, headers)
  body.write('hello')
  await flushPromises()
  return { ...harness, body, written }
}

/**
 * Fails a stream response before its first byte and lets the writer answer.
 *
 * @param error - What the stream fails with.
 * @returns The harness and the stream, the answer written and flushed.
 */
const failedEarly = async (error: Error): Promise<Harness & { body: PassThrough }> => {
  const harness = start()
  const body = new PassThrough()
  const written = harness.write(body)
  body.destroy(error)
  await flushPromises()
  harness.finish()
  await written
  return { ...harness, body }
}

describe('writeResponse stream', () => {
  it('writes no head before the first chunk', async () => {
    const harness = start()
    void harness.write(new PassThrough(), { 'X-One': '1' })
    await flushPromises()
    expect(harness.res.calls).toEqual([])
  })

  it('notes no status before the first chunk', async () => {
    const harness = start()
    void harness.write(new PassThrough())
    await flushPromises()
    expect(harness.exchange.status).toBe(0)
  })

  it('writes the head with the first chunk', async () => {
    const { res } = await underway()
    expect(steps(res)).toEqual(['writeHead', 'write'])
  })

  it('notes the status with the first chunk', async () => {
    const { exchange } = await underway()
    expect(exchange.status).toBe(200)
  })

  it('writes the head and ends at the end of an empty stream', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body)
    body.end()
    await flushPromises()
    expect(steps(harness.res)).toEqual(['writeHead', 'end'])
  })

  it('writes a Buffer chunk as it is', async () => {
    const { res } = await underway()
    expect(text(res)).toBe('hello')
  })

  it('writes a Uint8Array chunk', async () => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.push(new Uint8Array([0x68, 0x69]))
    await flushPromises()
    expect(text(harness.res)).toBe('hi')
  })

  it('writes a string chunk as UTF-8', async () => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.push('héllo')
    await flushPromises()
    expect(harness.res.calls.at(-1)).toEqual(['write', Buffer.from('héllo', 'utf8')])
  })

  it.each([
    ['an empty string', ''],
    ['an empty Buffer', Buffer.alloc(0)],
  ])('skips %s without writing a head', async (_title, chunk) => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.push(chunk)
    await flushPromises()
    expect(harness.res.calls).toEqual([])
  })

  it('writes the chunks in order and ends at the end of the stream', async () => {
    const { res, body } = await underway()
    body.end(', world')
    await flushPromises()
    expect({ steps: steps(res), text: text(res) }).toEqual({ steps: ['writeHead', 'write', 'write', 'end'], text: 'hello, world' })
  })

  it('sends a stream without a declared length chunked', async () => {
    const { res } = await underway({ 'Content-Type': 'text/plain' })
    expect(lines(res)).toEqual([['Content-Type', 'text/plain']])
  })

  it('sets a stream flowing that its handler had paused', async () => {
    const harness = start()
    const body = new PassThrough()
    body.pause()
    body.write('hello')
    void harness.write(body)
    await flushPromises()
    expect(text(harness.res)).toBe('hello')
  })

  it('survives a stream that fails again right after the chunk that failed it', async () => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.once('data', () => void body.destroy(new Error('twice')))
    body.push({ not: 'bytes' })
    await flushPromises()
    expect(harness.res.calls).toContainEqual(['writeHead', 500])
  })

  it('pauses the stream after a write the response did not take', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    const body = new PassThrough()
    void harness.write(body)
    body.write('hello')
    await flushPromises()
    expect(body.isPaused()).toBe(true)
  })

  it('takes no further chunk before the response drains', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    const body = objects()
    void harness.write(body)
    body.push('one')
    body.push('two')
    await flushPromises()
    expect(text(harness.res)).toBe('one')
  })

  it('takes the next chunk at drain', async () => {
    const harness = start()
    harness.res.accepts.push(false)
    const body = objects()
    void harness.write(body)
    body.push('one')
    body.push('two')
    await flushPromises()
    harness.res.emit('drain')
    await flushPromises()
    expect(text(harness.res)).toBe('onetwo')
  })

  it('ends a stream that matches its declared length', async () => {
    const { res, body } = await underway({ 'Content-Length': '8' })
    body.end('abc')
    await flushPromises()
    expect(steps(res)).toEqual(['writeHead', 'write', 'write', 'end'])
  })

  it('ends an empty stream that declares no bytes, with its length', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body, { 'Content-Length': '0' })
    body.end()
    await flushPromises()
    expect(harness.res.calls).toEqual([['setHeader', 'Content-Length', '0'], ['writeHead', 200], ['end']])
  })

  it('settles the outcome as sent once the stream response is flushed', async () => {
    const { exchange, body, finish, written } = await underway()
    body.end()
    await flushPromises()
    finish()
    await written
    expect(exchange.outcome).toBe('sent')
  })

  it('reports nothing for a stream written to its end', async () => {
    const { events, body, finish, written } = await underway()
    body.end()
    await flushPromises()
    finish()
    await written
    expect(events).toEqual([expect.objectContaining({ type: 'request', status: 200, outcome: 'sent', annotations: {} })])
  })

  it('leaves none of its listeners on a stream written to its end', async () => {
    const harness = start()
    const body = new Readable({ read: () => undefined, autoDestroy: false })
    void harness.write(body)
    body.push(null)
    await flushPromises()
    expect(listeners(body)).toEqual(KERNEL_ONLY)
  })
})

describe('writeResponse stream failures before the first byte', () => {
  it('answers a stream error with the 500', async () => {
    const { res } = await failedEarly(new RangeError('boom'))
    expect(heads(res)).toEqual([500])
  })

  it('answers with the plain body and headers of an internal failure', async () => {
    const { res } = await failedEarly(new RangeError('boom'))
    expect({ lines: lines(res), text: text(res) }).toEqual({
      lines: [
        ['Content-Type', 'text/plain; charset=utf-8'],
        ['Cache-Control', 'no-store'],
        ['Content-Length', '21'],
      ],
      text: 'Internal Server Error',
    })
  })

  it('reports the stream error once, by its name', async () => {
    const { events } = await failedEarly(new RangeError('boom'))
    expect(failures(events)).toEqual([{ code: 'stream-failed', name: 'RangeError' }])
  })

  it('reports the failure with the method and the path of its request', async () => {
    const { events } = await failedEarly(new RangeError('boom'))
    expect(events[0]).toEqual({
      type: 'failure',
      code: 'stream-failed',
      name: 'RangeError',
      method: 'GET',
      route: null,
      path: '/files/report',
    })
  })

  it('annotates the request as an internal failure that was sent', async () => {
    const { events } = await failedEarly(new RangeError('boom'))
    expect(events.filter((event): event is RequestEvent => event.type === 'request')).toEqual([
      expect.objectContaining({ status: 500, outcome: 'sent', annotations: { failure: 'internal' } }),
    ])
  })

  it('leaves the socket alone', async () => {
    const { socket } = await failedEarly(new RangeError('boom'))
    expect(socket.destroyed).toBe(0)
  })

  it('leaves none of its listeners on the failed stream', async () => {
    const { body } = await failedEarly(new RangeError('boom'))
    expect(LISTENED.map((event) => body.listenerCount(event))).toEqual(KERNEL_ONLY)
  })

  it('answers a chunk that is neither bytes nor a string with the 500', async () => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.push({ not: 'bytes' })
    await flushPromises()
    expect({ heads: heads(harness.res), failures: failures(harness.events) }).toEqual({
      heads: [500],
      failures: [{ code: 'stream-failed', name: 'TypeError' }],
    })
  })

  it('releases a stream that yielded a chunk it cannot write', async () => {
    const harness = start()
    const body = objects()
    void harness.write(body)
    body.push(7)
    await flushPromises()
    expect(body.destroyed).toBe(true)
  })

  it('answers a stream that closes without ending with the 500', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body)
    body.destroy()
    await flushPromises()
    expect({ heads: heads(harness.res), failures: failures(harness.events) }).toEqual({
      heads: [500],
      failures: [{ code: 'stream-failed', name: 'Error' }],
    })
  })

  it.each([
    ['destroyed', (body: Readable) => void body.destroy()],
    ['read to its end', (body: Readable) => void body.resume().push(null)],
    ['read from', (body: Readable) => void (body.push('peeked'), body.read())],
    ['failed', (body: Readable) => void body.on('error', () => undefined).destroy(new Error('gone'))],
  ])('answers a stream that arrives %s with the 500', async (_title, use) => {
    const harness = start()
    const body = new Readable({ read: () => undefined, autoDestroy: false })
    use(body)
    await flushPromises()
    void harness.write(body)
    expect({ heads: heads(harness.res), failures: failures(harness.events) }).toEqual({
      heads: [500],
      failures: [{ code: 'stream-failed', name: 'Error' }],
    })
  })

  it('reports a stream that arrives failed by the name of its own error', async () => {
    const harness = start()
    const body = new PassThrough()
    body.destroy(new SyntaxError('gone'))
    void harness.write(body)
    await flushPromises()
    expect(failures(harness.events)).toEqual([{ code: 'stream-failed', name: 'SyntaxError' }])
  })

  it('releases a stream that arrives used', () => {
    const harness = start()
    const body = new PassThrough()
    body.write('peeked')
    body.read()
    void harness.write(body)
    expect(body.destroyed).toBe(true)
  })

  it('answers a first chunk that passes the declared length with the 500', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body, { 'Content-Length': '3' })
    body.write('hello')
    await flushPromises()
    expect({ heads: heads(harness.res), text: text(harness.res), failures: failures(harness.events) }).toEqual({
      heads: [500],
      text: 'Internal Server Error',
      failures: [{ code: 'stream-failed', name: 'RangeError' }],
    })
  })

  it('answers an empty stream that declared bytes with the 500', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body, { 'Content-Length': '3' })
    body.end()
    await flushPromises()
    expect({ heads: heads(harness.res), failures: failures(harness.events) }).toEqual({
      heads: [500],
      failures: [{ code: 'stream-failed', name: 'RangeError' }],
    })
  })

  it('does not send the declared length of the failed stream on the 500', async () => {
    const harness = start()
    const body = new PassThrough()
    void harness.write(body, { 'Content-Length': '3', 'X-One': '1' })
    body.end()
    await flushPromises()
    expect(lines(harness.res)).toEqual([
      ['Content-Type', 'text/plain; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['Content-Length', '21'],
    ])
  })
})

describe('writeResponse stream failures after the first byte', () => {
  it('destroys the socket when the stream fails', async () => {
    const { socket, body } = await underway()
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(socket.destroyed).toBe(1)
  })

  it('reports the stream error once', async () => {
    const { events, body } = await underway()
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(failures(events)).toEqual([{ code: 'stream-failed', name: 'RangeError' }])
  })

  it('settles the outcome as a failed write', async () => {
    const { exchange, body } = await underway()
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(exchange.outcome).toBe('write-failed')
  })

  it('aborts the signal', async () => {
    const { exchange, body } = await underway()
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(exchange.context.signal.aborted).toBe(true)
  })

  it('neither ends the response nor writes a second head', async () => {
    const { res, body } = await underway()
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(steps(res)).toEqual(['writeHead', 'write'])
  })

  it('resolves without waiting for the response', async () => {
    const { body, written } = await underway()
    body.destroy(new RangeError('boom'))
    expect(await written).toBeUndefined()
  })

  it('treats a stream that closes without ending the same way', async () => {
    const { exchange, socket, events, body } = await underway()
    body.destroy()
    await flushPromises()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed, failures: failures(events) }).toEqual({
      outcome: 'write-failed',
      destroyed: 1,
      failures: [{ code: 'stream-failed', name: 'Error' }],
    })
  })

  it('never writes the bytes that pass the declared length', async () => {
    const { res, body } = await underway({ 'Content-Length': '7' })
    body.write('!!!')
    await flushPromises()
    expect(text(res)).toBe('hello')
  })

  it('cuts a stream that passes its declared length', async () => {
    const { exchange, socket, events, body } = await underway({ 'Content-Length': '7' })
    body.write('!!!')
    await flushPromises()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed, failures: failures(events), released: body.destroyed }).toEqual({
      outcome: 'write-failed',
      destroyed: 1,
      failures: [{ code: 'stream-failed', name: 'RangeError' }],
      released: true,
    })
  })

  it('does not end a stream that stops short of its declared length', async () => {
    const { res, body } = await underway({ 'Content-Length': '7' })
    body.end()
    await flushPromises()
    expect(steps(res)).toEqual(['writeHead', 'write'])
  })

  it('cuts a stream that stops short of its declared length', async () => {
    const { exchange, socket, events, body } = await underway({ 'Content-Length': '7' })
    body.end()
    await flushPromises()
    expect({ outcome: exchange.outcome, destroyed: socket.destroyed, failures: failures(events) }).toEqual({
      outcome: 'write-failed',
      destroyed: 1,
      failures: [{ code: 'stream-failed', name: 'RangeError' }],
    })
  })

  it('reports nothing for a stream that fails after the exchange got its outcome', async () => {
    const { exchange, events, body } = await underway()
    exchange.settleOutcome('shutdown')
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(failures(events)).toEqual([])
  })

  it('leaves the socket to whoever settled the outcome', async () => {
    const { exchange, socket, body } = await underway()
    exchange.settleOutcome('shutdown')
    body.destroy(new RangeError('boom'))
    await flushPromises()
    expect(socket.destroyed).toBe(0)
  })
})
