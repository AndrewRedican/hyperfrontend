import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { ServiceClock } from './clock'
import type { ServiceResponse, Step } from './contract'
import type { ServiceEvent } from './events'
import type { ServiceListener } from './listener'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { httpError } from './http-error'
import { createServiceListener } from './listener'

/** The bounds of a service a spec may set on a listener. */
interface Bounds {
  /** The cap of a body read that gives none. */
  readonly bodyBytes?: number
  /** How many forwarding hops are believed. */
  readonly trustedProxyHops?: number
}

/** A fake that records the calls made on it. */
interface Recording {
  /** Every call in order: the method, then its arguments. */
  readonly calls: unknown[][]
}

/** One timer of the fake clock. */
interface Timer {
  /** What the timer runs when a spec fires it. */
  readonly callback: () => void
  /** The delay it was started with. */
  readonly ms: number
  /** Whether it was cancelled. */
  cleared: boolean
}

/** The fake socket: it records what the kernel does to it. */
interface FakeSocket extends EventEmitter {
  /** The peer's address. */
  readonly remoteAddress: string
  /** Whether a bare answer could still be written. */
  writable: boolean
  /** How many bytes the peer has sent. */
  bytesRead: number
  /** Whether the socket was destroyed. */
  destroyed: boolean
  /** Every call in order: the method, then its arguments. */
  readonly calls: unknown[][]
}

/** The fake response: it records every call and answers a write as a spec tells it to. */
interface FakeResponse extends EventEmitter {
  /** Whether the response has been flushed. */
  writableFinished: boolean
  /** Every call in order: the method, then its arguments. */
  readonly calls: unknown[][]
  /** What the next calls of `write` return; `true` once the list is empty. */
  readonly accepts: boolean[]
}

/** What one fake request is sent with. */
interface Sending {
  /** The request method. */
  readonly method?: string
  /** The raw request target. */
  readonly url?: string
  /** The lower-cased request headers. */
  readonly headers?: Record<string, string>
  /** Whether the request arrives through `checkContinue`. */
  readonly expectsContinue?: boolean
  /** Whether the request has been received completely once Node's event has returned; `true` when omitted. */
  readonly complete?: boolean
}

/** One fake request in flight. */
interface Sent {
  /** The fake request. */
  readonly req: PassThrough
  /** The fake response. */
  readonly res: FakeResponse
  /** Flushes the fake response and closes it, as Node does after the last byte. */
  finish(): void
}

/** A listener over fakes and everything around it a spec drives or reads. */
interface Harness {
  /** The listener under test. */
  readonly listener: ServiceListener
  /** The fake socket every request of this harness arrives on. */
  readonly socket: FakeSocket
  /** Every event the sink received. */
  readonly events: ServiceEvent[]
  /** Every timer the kernel started. */
  readonly timers: Timer[]
  /** Hands one fake request to the listener. */
  send(sending?: Sending): Sent
}

const ok = (): ServiceResponse => ({ status: 200, headers: {}, body: Buffer.from('ok') })

/**
 * Builds a socket that records what is done to it.
 *
 * @returns An emitter with the members the kernel reads from a socket, every call landing in its `calls` list.
 */
const fakeSocket = (): FakeSocket => {
  const calls: unknown[][] = []
  const socket: FakeSocket = Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    writable: true,
    bytesRead: 12,
    destroyed: false,
    calls,
    write: (text: string) => void calls.push(['write', text]),
    destroySoon: () => void calls.push(['destroySoon']),
    destroy: () => {
      socket.destroyed = true
      calls.push(['destroy'])
    },
  })
  return socket
}

/**
 * Builds a clock that records timers and never fires one by itself.
 *
 * @param timers - Where every started timer is recorded.
 * @returns A time source that stands still at 0 and whose timers a spec fires by hand.
 */
const fakeClock = (timers: Timer[]): ServiceClock => ({
  now: () => 0,
  setTimeout: (callback: () => void, ms: number) => {
    const timer = { callback, ms, cleared: false }
    timers.push(timer)
    return timer
  },
  clearTimeout: (handle: unknown) => void ((handle as Timer).cleared = true),
})

/**
 * Builds a listener over the given steps, with a fake clock, a recording sink and one fake socket.
 *
 * @param steps - The pipeline the listener runs.
 * @param options - What differs from a body cap of 16 bytes, no trusted hop and a write bound of 1234 ms.
 * @returns The listener and its surroundings.
 */
const start = (steps: readonly Step[], options: Bounds = {}): Harness => {
  const events: ServiceEvent[] = []
  const timers: Timer[] = []
  const socket = fakeSocket()
  const listener = createServiceListener(
    steps,
    { bodyBytes: 16, trustedProxyHops: 0, writeIdleTimeoutMs: 1234, ...options },
    { clock: fakeClock(timers), report: (event) => void events.push(event) }
  )
  const send = (sending: Sending = {}): Sent => {
    const req = Object.assign(new PassThrough(), {
      method: sending.method ?? 'GET',
      url: sending.url ?? '/',
      headers: sending.headers ?? {},
      // note: inside Node's event a request never counts as complete, not even a bodiless one
      complete: false,
      socket,
    })
    req.end()
    const calls: unknown[][] = []
    const accepts: boolean[] = []
    const res: FakeResponse = Object.assign(new EventEmitter(), {
      socket,
      writableFinished: false,
      headersSent: false,
      calls,
      accepts,
      setHeader: (name: string, value: unknown) => void calls.push(['setHeader', name, value]),
      writeHead: (status: number) => void calls.push(['writeHead', status]),
      writeContinue: () => void calls.push(['writeContinue']),
      write: (chunk: Uint8Array) => {
        calls.push(['write', chunk.length])
        return accepts.shift() ?? true
      },
      end: (...chunk: Uint8Array[]) => void calls.push(['end', ...chunk.map((bytes) => bytes.toString())]),
    })
    const handle = sending.expectsContinue === true ? listener.checkContinue : listener.request
    handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
    req.complete = sending.complete ?? true
    return {
      req,
      res,
      finish: () => {
        res.writableFinished = true
        res.emit('finish')
        res.emit('close')
      },
    }
  }
  return { listener, socket, events, timers, send }
}

/**
 * Picks the calls of one method out of a fake's record.
 *
 * @param fake - The fake response or socket.
 * @param method - The method to keep.
 * @returns The recorded calls of that method, in order.
 */
const callsOf = (fake: Recording, method: string): unknown[][] => fake.calls.filter(([name]) => name === method)

describe('createServiceListener', () => {
  describe('flow', () => {
    it('hands the request to the steps', () => {
      const seen: unknown[] = []
      const harness = start([(request) => (seen.push([request.method, request.path, request.query.get('q')]), ok())])
      harness.send({ method: 'POST', url: '/a%20b?q=1' })
      expect(seen).toEqual([['POST', '/a b', '1']])
    })

    it('runs the steps outermost first, each seeing what the earlier ones added', async () => {
      const seen: unknown[] = []
      const outer = ((_request, _context, next) => next({ tenant: 't1' })) as Step
      const inner = ((_request, context) => (seen.push((context as unknown as { tenant: string }).tenant), ok())) as Step
      start([outer, inner]).send()
      await flushPromises()
      expect(seen).toEqual(['t1'])
    })

    it('writes what the steps answered', async () => {
      const { res } = start([ok]).send()
      await flushPromises()
      expect(res.calls).toEqual([
        ['setHeader', 'Content-Length', '2'],
        ['writeHead', 200],
        ['end', 'ok'],
      ])
    })

    it('writes one response per request', async () => {
      const sent = start([ok]).send()
      await flushPromises()
      sent.finish()
      await flushPromises()
      expect(callsOf(sent.res, 'writeHead')).toEqual([['writeHead', 200]])
    })

    it('writes nothing inside the request event', () => {
      expect(start([ok]).send().res.calls).toEqual([])
    })

    it('keeps the connection of a request that is complete once the event has returned', async () => {
      const { res } = start([ok]).send()
      await flushPromises()
      expect(callsOf(res, 'setHeader')).toEqual([['setHeader', 'Content-Length', '2']])
    })

    it('closes the connection of a request that is still arriving when its head is written', async () => {
      const { res } = start([ok]).send({ complete: false })
      await flushPromises()
      expect(callsOf(res, 'setHeader')).toContainEqual(['setHeader', 'Connection', 'close'])
    })

    it('answers 404 when no step answers', async () => {
      const { res } = start([(_request, _context, next) => next()]).send()
      await flushPromises()
      expect(callsOf(res, 'writeHead')).toEqual([['writeHead', 404]])
    })

    it('answers 404 with no step at all', async () => {
      const { res } = start([]).send()
      await flushPromises()
      expect(callsOf(res, 'writeHead')).toEqual([['writeHead', 404]])
    })

    it('renders a failure the outermost step threw', async () => {
      const refuse: Step = () => {
        throw httpError(403, 'refused')
      }
      const { res } = start([refuse]).send()
      await flushPromises()
      expect(callsOf(res, 'writeHead')).toEqual([['writeHead', 403]])
    })

    it('answers 500 and reports once when the outermost step throws anything else', async () => {
      const harness = start([() => Promise.reject(new RangeError('the secret detail'))])
      const { res } = harness.send({ url: '/broken' })
      await flushPromises()
      expect({ head: callsOf(res, 'writeHead'), events: harness.events }).toEqual({
        head: [['writeHead', 500]],
        events: [{ type: 'failure', code: 'step-failed', name: 'RangeError', method: 'GET', route: null, path: '/broken' }],
      })
    })

    it('emits one request event when the response has closed', async () => {
      const harness = start([ok])
      const sent = harness.send({ url: '/hello' })
      await flushPromises()
      sent.finish()
      expect(harness.events).toEqual([
        { type: 'request', method: 'GET', route: null, path: '/hello', status: 200, outcome: 'sent', durationMs: 0, annotations: {} },
      ])
    })

    it('releases a response that arrives after the client left', async () => {
      const body = new PassThrough()
      const harness = start([() => ({ status: 200, headers: {}, body })])
      harness.send().res.emit('close')
      await flushPromises()
      expect(body.destroyed).toBe(true)
    })
  })

  describe('a refused target', () => {
    it('is answered 400', async () => {
      const { res } = start([ok]).send({ url: '/a%2Fb' })
      await flushPromises()
      expect(res.calls).toEqual([
        ['setHeader', 'Content-Type', 'text/plain; charset=utf-8'],
        ['setHeader', 'Cache-Control', 'no-store'],
        ['setHeader', 'Content-Length', '11'],
        ['writeHead', 400],
        ['end', 'Bad Request'],
      ])
    })

    it('is not answered inside the request event', () => {
      expect(start([ok]).send({ url: '/a%2Fb' }).res.calls).toEqual([])
    })

    it('closes the connection of a request that is still arriving', async () => {
      const { res } = start([ok]).send({ url: '//', complete: false })
      await flushPromises()
      expect(callsOf(res, 'setHeader')).toContainEqual(['setHeader', 'Connection', 'close'])
    })

    it('runs no step', async () => {
      let runs = 0
      start([() => ((runs += 1), ok())]).send({ url: 'http://absolute.example/' })
      await flushPromises()
      expect(runs).toBe(0)
    })

    it('is reported with neither a route nor a path', async () => {
      const harness = start([ok])
      const sent = harness.send({ url: '/a/../b' })
      await flushPromises()
      sent.finish()
      expect(harness.events).toEqual([
        {
          type: 'request',
          method: 'GET',
          route: null,
          path: null,
          status: 400,
          outcome: 'sent',
          durationMs: 0,
          annotations: { failure: 'malformed-target' },
        },
      ])
    })
  })

  describe('options', () => {
    const read: Step = async (request) => ({ status: 200, headers: {}, body: await request.body.bytes() })

    it('answers 100 Continue at the first read of a request that arrived through checkContinue', async () => {
      const { res } = start([read]).send({ method: 'POST', expectsContinue: true })
      await flushPromises()
      expect(callsOf(res, 'writeContinue')).toEqual([['writeContinue']])
    })

    it('answers no 100 Continue for a request that arrived through request', async () => {
      const { res } = start([read]).send({ method: 'POST' })
      await flushPromises()
      expect(callsOf(res, 'writeContinue')).toEqual([])
    })

    it('caps a body read at the body bytes of the service', async () => {
      const { res } = start([read], { bodyBytes: 16 }).send({ method: 'POST', headers: { 'content-length': '17' } })
      await flushPromises()
      expect(callsOf(res, 'writeHead')).toEqual([['writeHead', 413]])
    })

    it('reads a body of exactly the body bytes of the service', async () => {
      const { res } = start([read], { bodyBytes: 16 }).send({ method: 'POST', headers: { 'content-length': '16' } })
      await flushPromises()
      expect(callsOf(res, 'writeHead')).toEqual([['writeHead', 200]])
    })

    it('believes as many forwarding hops as the service trusts', () => {
      const seen: string[] = []
      const harness = start([(_request, context) => (seen.push(context.client.address), ok())], { trustedProxyHops: 2 })
      harness.send({ headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.2, 198.51.100.3' } })
      expect(seen).toEqual(['198.51.100.2'])
    })

    it('bounds a wait for the client by the write idle time of the service', async () => {
      const harness = start([ok])
      harness.send()
      await flushPromises()
      expect(harness.timers.map((timer) => timer.ms)).toEqual([1234])
    })

    it('measures time on the injected clock', async () => {
      const harness = start([ok])
      const sent = harness.send()
      await flushPromises()
      sent.finish()
      expect(harness.timers.map((timer) => timer.cleared)).toEqual([true])
    })
  })

  describe('the connection registry', () => {
    it('leaves a connection open while one of its exchanges is in flight', () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      harness.send()
      void harness.listener.drain(500)
      expect(harness.socket.calls).toEqual([])
    })

    it('closes a draining connection when its last exchange ends', async () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      const sent = harness.send()
      void harness.listener.drain(500)
      await flushPromises()
      sent.finish()
      expect(harness.socket.calls).toEqual([['destroySoon']])
    })

    it('writes the head of the last exchange in flight on a connection with Connection: close while draining', async () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      const sent = harness.send()
      void harness.listener.drain(500)
      await flushPromises()
      expect(callsOf(sent.res, 'setHeader')).toContainEqual(['setHeader', 'Connection', 'close'])
    })

    it('keeps the connection in the head of an exchange with a later one in flight while draining, so the later one is answered', async () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      const first = harness.send()
      harness.send()
      void harness.listener.drain(500)
      await flushPromises()
      expect(callsOf(first.res, 'setHeader')).toEqual([['setHeader', 'Content-Length', '2']])
    })

    it('cuts an exchange that outlives the grace as shutdown', async () => {
      const harness = start([() => new Promise<ServiceResponse>(() => undefined)])
      harness.listener.connection(harness.socket as unknown as Socket)
      const sent = harness.send({ url: '/stuck' })
      void harness.listener.drain(500)
      harness.timers.find((timer) => timer.ms === 500)?.callback()
      sent.res.emit('close')
      expect(harness.events).toEqual([expect.objectContaining({ type: 'request', path: '/stuck', status: 0, outcome: 'shutdown' })])
    })

    it('settles the exchanges of a connection whose request timed out', async () => {
      const harness = start([() => new Promise<ServiceResponse>(() => undefined)])
      harness.listener.connection(harness.socket as unknown as Socket)
      const sent = harness.send({ url: '/slow-upload' })
      harness.listener.clientError(
        Object.assign(new Error('timeout'), { code: 'ERR_HTTP_REQUEST_TIMEOUT' }),
        harness.socket as unknown as Socket
      )
      sent.res.emit('close')
      expect(harness.events).toEqual([
        { type: 'failure', code: 'request-timeout', name: 'Error', method: null, route: null, path: null },
        expect.objectContaining({ type: 'request', path: '/slow-upload', status: 408, outcome: 'request-timeout' }),
      ])
    })
  })

  describe('server error', () => {
    it('emits one server-error failure event that names no request', () => {
      const harness = start([ok])
      harness.listener.serverError(Object.assign(new RangeError('accept EMFILE'), { code: 'EMFILE' }))
      expect(harness.events).toEqual([{ type: 'failure', code: 'server-error', name: 'RangeError', method: null, route: null, path: null }])
    })

    it('emits a frozen event', () => {
      const harness = start([ok])
      harness.listener.serverError(new Error('accept EMFILE'))
      expect(Object.isFrozen(harness.events[0])).toBe(true)
    })

    it('ignores a sink that throws', () => {
      const listener = createServiceListener(
        [ok],
        { bodyBytes: 16, trustedProxyHops: 0, writeIdleTimeoutMs: 1234 },
        {
          report: () => {
            throw new Error('the sink is down')
          },
        }
      )
      expect(() => listener.serverError(new Error('accept EMFILE'))).not.toThrow()
    })

    it('stays silent without a sink', () => {
      const listener = createServiceListener([ok], { bodyBytes: 16, trustedProxyHops: 0, writeIdleTimeoutMs: 1234 }, {})
      expect(() => listener.serverError(new Error('accept EMFILE'))).not.toThrow()
    })
  })

  describe('wiring', () => {
    it('returns a frozen set of listeners', () => {
      expect(Object.isFrozen(start([ok]).listener)).toBe(true)
    })

    it('tracks a socket from its connection event, so a drain destroys it while idle', () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      void harness.listener.drain(500)
      expect(harness.socket.calls).toEqual([['destroy']])
    })

    it('answers a malformed request on the socket and closes it', () => {
      const harness = start([ok])
      harness.listener.clientError(Object.assign(new Error('parse'), { code: 'HPE_INVALID_METHOD' }), harness.socket as unknown as Socket)
      expect(harness.socket.calls).toEqual([
        ['write', 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'],
        ['destroy'],
      ])
    })

    it('reports a malformed request to the sink', () => {
      const harness = start([ok])
      harness.listener.clientError(Object.assign(new Error('parse'), { code: 'HPE_INVALID_METHOD' }), harness.socket as unknown as Socket)
      expect(harness.events).toEqual([{ type: 'failure', code: 'malformed-request', name: 'Error', method: null, route: null, path: null }])
    })

    it('times the grace of a drain on the injected clock', () => {
      const harness = start([ok])
      void harness.listener.drain(750)
      expect(harness.timers).toEqual([expect.objectContaining({ ms: 750, cleared: true })])
    })

    it('resolves a drain once every tracked socket has closed', async () => {
      const harness = start([ok])
      harness.listener.connection(harness.socket as unknown as Socket)
      const drained = harness.listener.drain(500).then(() => 'drained')
      harness.socket.emit('close')
      expect(await drained).toBe('drained')
    })

    it('runs on the system clock when none is injected', async () => {
      const listener = createServiceListener([ok], { bodyBytes: 16, trustedProxyHops: 0, writeIdleTimeoutMs: 1234 }, {})
      // why: one millisecond of real time is the longest this timer can stay pending, whatever the outcome of the test
      expect(await listener.drain(1).then(() => 'drained')).toBe('drained')
    })
  })
})
