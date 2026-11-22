import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { RequestEvent, ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createExchange } from './exchange'

/** What one fake exchange is started with; everything has a default. */
interface Setup {
  /** The request method. */
  readonly method?: string
  /** The raw request target. */
  readonly url?: string
  /** The headers as Node would hand them over, lower-cased. */
  readonly headers?: IncomingHttpHeaders
  /** The address the socket reports. */
  readonly remoteAddress?: string | undefined
  /** The forwarding hops believed. */
  readonly hops?: number
  /** The default cap of the buffering body readers. */
  readonly bodyBytes?: number
  /** Whether the request arrived through `checkContinue`. */
  readonly expectsContinue?: boolean
  /** A sink in place of the recording one. */
  readonly sink?: (event: ServiceEvent) => void
}

/** One fake exchange and everything around it a spec drives or reads. */
interface Harness {
  /** The exchange under test. */
  readonly exchange: Exchange
  /** The fake request stream. */
  readonly req: PassThrough
  /** The fake response. */
  readonly res: EventEmitter & { writableFinished: boolean; continued: number }
  /** The fake socket. */
  readonly socket: EventEmitter
  /** Every event the recording sink received, in order. */
  readonly events: ServiceEvent[]
  /** The fake clock's reading, which a spec moves by hand. */
  readonly time: { now: number }
}

/**
 * Starts an exchange over a fake request, response and socket.
 *
 * @param setup - What differs from a plain `GET /tickets/7?page=2`.
 * @returns The exchange and its surroundings.
 */
const start = (setup: Setup = {}): Harness => {
  const socket = Object.assign(new EventEmitter(), { remoteAddress: 'remoteAddress' in setup ? setup.remoteAddress : '192.0.2.7' })
  const req = Object.assign(new PassThrough(), {
    method: setup.method ?? 'GET',
    url: setup.url ?? '/tickets/7?page=2',
    headers: setup.headers ?? { host: 'service.example' },
    complete: true,
    socket,
  })
  const res = Object.assign(new EventEmitter(), {
    writableFinished: false,
    continued: 0,
    writeContinue: () => void (res.continued += 1),
  })
  const events: ServiceEvent[] = []
  const time = { now: 1000 }
  const exchange = createExchange(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    { bodyBytes: setup.bodyBytes ?? 65536, trustedProxyHops: setup.hops ?? 0 },
    { now: () => time.now, setTimeout: () => undefined, clearTimeout: () => undefined },
    setup.sink ?? ((event) => void events.push(event)),
    setup.expectsContinue ?? false
  )
  return { exchange, req, res, socket, events, time }
}

/**
 * Ends a fake exchange the way a completed response does and returns its request event.
 *
 * @param harness - The fake exchange.
 * @returns The one request event the sink received.
 */
const finish = (harness: Harness): RequestEvent => {
  harness.res.writableFinished = true
  harness.res.emit('close')
  return harness.events.filter((event) => event.type === 'request')[0] as RequestEvent
}

describe('createExchange outcome', () => {
  it('starts with none', () => {
    expect(start().exchange.outcome).toBeNull()
  })

  it('takes the first cause', () => {
    const { exchange } = start()
    expect({ settled: exchange.settleOutcome('write-stalled'), outcome: exchange.outcome }).toEqual({
      settled: true,
      outcome: 'write-stalled',
    })
  })

  it('keeps the first cause when a second arrives', () => {
    const { exchange } = start()
    exchange.settleOutcome('request-timeout')
    expect({ settled: exchange.settleOutcome('sent'), outcome: exchange.outcome }).toEqual({ settled: false, outcome: 'request-timeout' })
  })

  it.each(['client-closed', 'request-timeout', 'write-stalled', 'write-failed', 'shutdown'] as const)(
    'aborts the signal for %s',
    (cause) => {
      const { exchange } = start()
      exchange.settleOutcome(cause)
      expect(exchange.context.signal.aborted).toBe(true)
    }
  )

  it('does not abort the signal for sent', () => {
    const { exchange } = start()
    exchange.settleOutcome('sent')
    expect(exchange.context.signal.aborted).toBe(false)
  })

  it('does not abort the signal for a cause that arrives after sent', () => {
    const { exchange } = start()
    exchange.settleOutcome('sent')
    exchange.settleOutcome('shutdown')
    expect(exchange.context.signal.aborted).toBe(false)
  })

  it('starts with a signal that has not aborted', () => {
    expect(start().exchange.context.signal.aborted).toBe(false)
  })
})

describe('createExchange end', () => {
  it('has not ended while the response and the socket are open', () => {
    expect(start().exchange.ended).toBe(false)
  })

  it('ends when the response closes', () => {
    const harness = start()
    harness.res.emit('close')
    expect(harness.exchange.ended).toBe(true)
  })

  it('ends when the socket closes although the response never does', () => {
    const harness = start()
    harness.socket.emit('close')
    expect({ ended: harness.exchange.ended, events: harness.events.length }).toEqual({ ended: true, events: 1 })
  })

  it('ends once when both close', () => {
    const harness = start()
    harness.res.emit('close')
    harness.socket.emit('close')
    expect(harness.events.map((event) => event.type)).toEqual(['request'])
  })

  it('ends once when the close of the socket is what closes the response', () => {
    const harness = start()
    // why: Node closes a response from its own listener on the socket, so the second close arrives while the first is still being delivered
    harness.socket.prependListener('close', () => void harness.res.emit('close'))
    harness.socket.emit('close')
    expect(harness.events.map((event) => event.type)).toEqual(['request'])
  })

  it('runs the callbacks once when the close of the socket is what closes the response', () => {
    const harness = start()
    const calls: string[] = []
    harness.exchange.onEnd(() => void calls.push('end'))
    harness.socket.prependListener('close', () => void harness.res.emit('close'))
    harness.socket.emit('close')
    expect(calls).toEqual(['end'])
  })

  it('listens for both closes until the end', () => {
    const { res, socket } = start()
    expect({ res: res.listenerCount('close'), socket: socket.listenerCount('close') }).toEqual({ res: 1, socket: 1 })
  })

  it('removes both listeners at the end', () => {
    const { res, socket } = start()
    socket.emit('close')
    expect({ res: res.listenerCount('close'), socket: socket.listenerCount('close') }).toEqual({ res: 0, socket: 0 })
  })

  it('leaves no listener on a socket that carried twenty exchanges', () => {
    const first = start()
    const exchanges = Array.from({ length: 20 }, () => {
      const harness = start()
      harness.res.emit('close')
      return harness
    })
    expect(exchanges.map(({ socket }) => socket.listenerCount('close')).concat(first.socket.listenerCount('close'))).toEqual([
      ...Array.from({ length: 20 }, () => 0),
      1,
    ])
  })

  it('runs the callbacks registered for the end, once and in order', () => {
    const harness = start()
    const calls: string[] = []
    harness.exchange.onEnd(() => void calls.push('first'))
    harness.exchange.onEnd(() => void calls.push('second'))
    harness.res.emit('close')
    harness.socket.emit('close')
    expect(calls).toEqual(['first', 'second'])
  })

  it('has ended by the time a callback runs', () => {
    const harness = start()
    const seen: boolean[] = []
    harness.exchange.onEnd(() => void seen.push(harness.exchange.ended))
    harness.res.emit('close')
    expect(seen).toEqual([true])
  })

  it('has settled the outcome by the time a callback runs', () => {
    const harness = start()
    const seen: unknown[] = []
    harness.exchange.onEnd(() => void seen.push(harness.exchange.outcome))
    harness.res.emit('close')
    expect(seen).toEqual(['client-closed'])
  })

  it('runs the callbacks before it emits the request event', () => {
    const harness = start()
    const seen: number[] = []
    harness.exchange.onEnd(() => void seen.push(harness.events.length))
    harness.res.emit('close')
    expect(seen).toEqual([0])
  })

  it('does not run a callback that was taken back', () => {
    const harness = start()
    const calls: string[] = []
    const remove = harness.exchange.onEnd(() => void calls.push('removed'))
    harness.exchange.onEnd(() => void calls.push('kept'))
    remove()
    harness.res.emit('close')
    expect(calls).toEqual(['kept'])
  })

  it('runs a callback registered after the end at once', () => {
    const harness = start()
    harness.res.emit('close')
    const calls: string[] = []
    harness.exchange.onEnd(() => void calls.push('late'))
    expect(calls).toEqual(['late'])
  })

  it('lets a callback registered after the end be taken back without effect', () => {
    const harness = start()
    harness.res.emit('close')
    expect(harness.exchange.onEnd(() => undefined)()).toBeUndefined()
  })

  it('listens for an error of the request, so one does not throw', () => {
    const { req } = start()
    expect(() => req.emit('error', new Error('the request failed'))).not.toThrow()
  })

  it('listens for an error of the response, so one does not throw', () => {
    const { res } = start()
    expect(() => res.emit('error', new Error('the response failed'))).not.toThrow()
  })

  it('sets the outcome sent when the response had finished', () => {
    const harness = start()
    expect(finish(harness).outcome).toBe('sent')
  })

  it('does not abort the signal at a normal end', () => {
    const harness = start()
    finish(harness)
    expect(harness.exchange.context.signal.aborted).toBe(false)
  })

  it('sets the outcome client-closed and aborts when the response had not finished', () => {
    const harness = start()
    harness.socket.emit('close')
    expect({ outcome: harness.exchange.outcome, aborted: harness.exchange.context.signal.aborted }).toEqual({
      outcome: 'client-closed',
      aborted: true,
    })
  })

  it('keeps an outcome that was settled before the end', () => {
    const harness = start()
    harness.exchange.settleOutcome('shutdown')
    expect(finish(harness).outcome).toBe('shutdown')
  })
})

describe('createExchange request event', () => {
  it('is emitted once, at the end', () => {
    const harness = start()
    const before = harness.events.length
    harness.res.emit('close')
    expect({ before, after: harness.events.map((event) => event.type) }).toEqual({ before: 0, after: ['request'] })
  })

  it('follows every failure event raised before the end', () => {
    const harness = start()
    harness.exchange.failure('stream-failed', new Error('cut'))
    harness.res.emit('close')
    expect(harness.events.map((event) => event.type)).toEqual(['failure', 'request'])
  })

  it('carries every field of a request no route claimed', () => {
    const harness = start({ method: 'POST', url: '/a%20b?token=secret' })
    harness.exchange.noteStatus(404)
    harness.exchange.context.annotate('failure', 'not-found')
    harness.time.now = 1042
    expect(finish(harness)).toEqual({
      type: 'request',
      method: 'POST',
      route: null,
      path: '/a b',
      status: 404,
      outcome: 'sent',
      durationMs: 42,
      annotations: { failure: 'not-found' },
    })
  })

  it('carries the route and no path once a route claimed the request', () => {
    const harness = start()
    harness.exchange.context.annotate('route', 'ticket')
    const { route, path } = finish(harness)
    expect({ route, path }).toEqual({ route: 'ticket', path: null })
  })

  it('carries neither a route nor a path for a target that was refused', () => {
    const { route, path } = finish(start({ url: '/a/../b' }))
    expect({ route, path }).toEqual({ route: null, path: null })
  })

  it('never carries the query', () => {
    expect(JSON.stringify(finish(start({ url: '/a?token=marker-in-the-query' })))).not.toContain('marker-in-the-query')
  })

  it('carries status 0 when no head was written', () => {
    const harness = start()
    harness.socket.emit('close')
    expect((harness.events[0] as RequestEvent).status).toBe(0)
  })

  it('rounds the duration to whole milliseconds', () => {
    const harness = start()
    harness.time.now = 1002.6
    expect(finish(harness).durationMs).toBe(3)
  })

  it('carries a duration of 0 when the clock stepped backwards', () => {
    const harness = start()
    harness.time.now = 400
    expect(finish(harness).durationMs).toBe(0)
  })

  it('is frozen, its annotations included', () => {
    const event = finish(start())
    expect([Object.isFrozen(event), Object.isFrozen(event.annotations)]).toEqual([true, true])
  })

  it('carries annotations without a prototype', () => {
    expect(Object.getPrototypeOf(finish(start()).annotations)).toBeNull()
  })

  it('carries an annotation named like a member of every object as its own entry', () => {
    const harness = start()
    harness.exchange.context.annotate('constructor', 'mine')
    expect(Object.entries(finish(harness).annotations)).toEqual([['constructor', 'mine']])
  })

  it('ignores a sink that throws', () => {
    const harness = start({
      sink: () => {
        throw new Error('the sink failed')
      },
    })
    expect(() => harness.res.emit('close')).not.toThrow()
  })

  it('ends although the sink throws', () => {
    const harness = start({
      sink: () => {
        throw new Error('the sink failed')
      },
    })
    harness.res.emit('close')
    expect(harness.exchange.ended).toBe(true)
  })

  it('ignores a sink that returns a promise that rejects', async () => {
    const harness = start({
      sink: async () => {
        throw new Error('the shipper failed')
      },
    })
    harness.res.emit('close')
    // why: the runner fails this file on an unhandled rejection, so reaching the assertion is the proof
    expect(await flushPromises()).toBeUndefined()
  })

  it('ignores a sink that returns a thenable whose then throws', () => {
    const thenable = {
      then: (): void => {
        throw new Error('the thenable failed')
      },
    }
    const harness = start({ sink: (() => thenable) as unknown as () => void })
    expect(() => harness.res.emit('close')).not.toThrow()
  })

  it('ignores a sink that throws for a reported failure', () => {
    const harness = start({
      sink: () => {
        throw new Error('the sink failed')
      },
    })
    expect(() => harness.exchange.context.report('store-down', new Error('down'))).not.toThrow()
  })
})
