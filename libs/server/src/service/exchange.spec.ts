import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { ServiceRequest } from './contract'
import type { RequestEvent, ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from '@hyperfrontend/testing'
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
 * Reads the request of an exchange whose target was accepted.
 *
 * @param harness - The fake exchange.
 * @returns The request steps would receive.
 */
const requestOf = (harness: Harness): ServiceRequest => harness.exchange.request as ServiceRequest

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

/**
 * Catches what a call throws.
 *
 * @param run - The call.
 * @returns `Name: message` of the thrown error, or `null` when nothing was thrown.
 */
const thrownBy = (run: () => void): string | null => {
  try {
    run()
    return null
  } catch (error) {
    return `${(error as Error).name}: ${(error as Error).message}`
  }
}

const NAME_MESSAGE =
  'TypeError: annotate: the name must be a lower-case letter followed by up to 31 lower-case letters, digits, "_" or "-".'
const VALUE_MESSAGE = 'TypeError: annotate: the value must be a string, a finite number or a boolean.'

describe('createExchange request', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(requestOf(start()))).toBe(true)
  })

  it('passes the method and the raw url through', () => {
    const { method, url } = requestOf(start({ method: 'POST', url: '/a%20b?q=1' }))
    expect({ method, url }).toEqual({ method: 'POST', url: '/a%20b?q=1' })
  })

  it('carries the canonical path', () => {
    expect(requestOf(start({ url: '/a%20b/caf%C3%A9?q=1' })).path).toBe('/a b/caf\u00e9')
  })

  it('carries the parsed query', () => {
    expect(requestOf(start({ url: '/search?tag=a&tag=b+c' })).query.getAll('tag')).toEqual(['a', 'b c'])
  })

  it('copies the headers', () => {
    const headers = { host: 'service.example', accept: 'text/plain' }
    expect({ ...requestOf(start({ headers })).headers }).toEqual(headers)
  })

  it('freezes its copy of the headers', () => {
    expect(Object.isFrozen(requestOf(start()).headers)).toBe(true)
  })

  it('makes its copy of the headers without a prototype', () => {
    expect(Object.getPrototypeOf(requestOf(start()).headers)).toBeNull()
  })

  it('leaves the header object of Node writable and apart from its copy', () => {
    const headers: IncomingHttpHeaders = { host: 'service.example' }
    const request = requestOf(start({ headers }))
    headers['x-added'] = 'later'
    expect(request.headers['x-added']).toBeUndefined()
  })

  it('freezes the array of a set-cookie header', () => {
    expect(Object.isFrozen(requestOf(start({ headers: { 'set-cookie': ['a=1', 'b=2'] } })).headers['set-cookie'])).toBe(true)
  })

  it('copies the array of a set-cookie header, so the array of Node stays as it was', () => {
    const cookies = ['a=1', 'b=2']
    const request = requestOf(start({ headers: { 'set-cookie': cookies } }))
    expect({ frozen: Object.isFrozen(cookies), copy: request.headers['set-cookie'] }).toEqual({ frozen: false, copy: ['a=1', 'b=2'] })
  })

  it('starts with empty frozen params', () => {
    const { params } = requestOf(start())
    expect({ keys: Object.keys(params), frozen: Object.isFrozen(params) }).toEqual({ keys: [], frozen: true })
  })

  it('makes the params without a prototype', () => {
    expect(Object.getPrototypeOf(requestOf(start()).params)).toBeNull()
  })

  it('has no request for a target that is refused', () => {
    expect(start({ url: '/a%2Fb' }).exchange.request).toBeNull()
  })

  it('gives the request a body that reads what the client sent', async () => {
    const harness = start({ method: 'POST' })
    harness.req.end('hello')
    expect((await requestOf(harness).body.bytes()).toString()).toBe('hello')
  })

  it('caps the body at the configured default', async () => {
    const harness = start({ method: 'POST', bodyBytes: 4, headers: { 'content-length': '5' } })
    expect(
      await requestOf(harness)
        .body.bytes()
        .catch((error: Error) => error.message)
    ).toBe('body-too-large')
  })

  it('cuts a pending body read short when the exchange ends', async () => {
    const harness = start({ method: 'POST' })
    const read = requestOf(harness)
      .body.bytes()
      .catch((error: Error) => error.message)
    harness.res.emit('close')
    expect(await read).toBe('body-incomplete')
  })

  it('sends 100 Continue on the first body read of a request that expects it', async () => {
    const harness = start({ method: 'POST', expectsContinue: true })
    harness.req.end()
    await requestOf(harness).body.bytes()
    expect(harness.res.continued).toBe(1)
  })

  it('sends no 100 Continue for a request that did not ask', async () => {
    const harness = start({ method: 'POST' })
    harness.req.end()
    await requestOf(harness).body.bytes()
    expect(harness.res.continued).toBe(0)
  })
})

describe('createExchange members', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(start().exchange)).toBe(true)
  })

  it('exposes the request, the response and the socket it was started with', () => {
    const { exchange, req, res, socket } = start()
    expect([exchange.req === (req as unknown), exchange.res === (res as unknown), exchange.socket === (socket as unknown)]).toEqual([
      true,
      true,
      true,
    ])
  })

  it.each([true, false])('says whether the request expects 100 Continue: %s', (expectsContinue) => {
    expect(start({ expectsContinue }).exchange.expectsContinue).toBe(expectsContinue)
  })

  it('starts with no status', () => {
    expect(start().exchange.status).toBe(0)
  })

  it('remembers the status that was noted', () => {
    const { exchange } = start()
    exchange.noteStatus(201)
    expect(exchange.status).toBe(201)
  })

  it('freezes the context', () => {
    expect(Object.isFrozen(start().exchange.context)).toBe(true)
  })
})

describe('createExchange client', () => {
  it('is the socket peer by default', () => {
    expect(start().exchange.context.client).toEqual({ address: '192.0.2.7' })
  })

  it('is frozen', () => {
    expect(Object.isFrozen(start().exchange.context.client)).toBe(true)
  })

  it('is empty when the socket reports no address', () => {
    expect(start({ remoteAddress: undefined }).exchange.context.client.address).toBe('')
  })

  it('ignores the forwarding header when no hop is trusted', () => {
    expect(start({ headers: { 'x-forwarded-for': '203.0.113.9' } }).exchange.context.client.address).toBe('192.0.2.7')
  })

  it('is the last entry with one trusted hop', () => {
    const headers = { 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }
    expect(start({ hops: 1, headers }).exchange.context.client.address).toBe('203.0.113.9')
  })

  it('is the nth entry from the right with n trusted hops, trimmed', () => {
    const headers = { 'x-forwarded-for': 'spoofed,  198.51.100.1 , 203.0.113.9' }
    expect(start({ hops: 2, headers }).exchange.context.client.address).toBe('198.51.100.1')
  })

  it('never prefers the leftmost entry', () => {
    const headers = { 'x-forwarded-for': 'spoofed, 198.51.100.1, 203.0.113.9, 203.0.113.10' }
    expect(start({ hops: 2, headers }).exchange.context.client.address).toBe('203.0.113.9')
  })

  it('falls back to the peer when the header has fewer entries than hops', () => {
    expect(start({ hops: 2, headers: { 'x-forwarded-for': '203.0.113.9' } }).exchange.context.client.address).toBe('192.0.2.7')
  })

  it('falls back to the peer when hops are trusted and the header is absent', () => {
    expect(start({ hops: 1 }).exchange.context.client.address).toBe('192.0.2.7')
  })

  it('falls back to the peer when the entry is empty', () => {
    expect(start({ hops: 1, headers: { 'x-forwarded-for': '203.0.113.9, ' } }).exchange.context.client.address).toBe('192.0.2.7')
  })

  it('falls back to the peer when the entry has more than 64 characters', () => {
    expect(start({ hops: 1, headers: { 'x-forwarded-for': 'a'.repeat(65) } }).exchange.context.client.address).toBe('192.0.2.7')
  })

  it('accepts an entry of exactly 64 characters', () => {
    expect(start({ hops: 1, headers: { 'x-forwarded-for': 'a'.repeat(64) } }).exchange.context.client.address).toBe('a'.repeat(64))
  })
})

describe('createExchange annotate', () => {
  it('records a field for the request event', () => {
    const harness = start()
    harness.exchange.context.annotate('subject', 'u1')
    expect(finish(harness).annotations).toEqual({ subject: 'u1' })
  })

  it('records a string, a number and a boolean as they are', () => {
    const harness = start()
    harness.exchange.context.annotate('text', '')
    harness.exchange.context.annotate('count', -1.5)
    harness.exchange.context.annotate('cached', false)
    expect(finish(harness).annotations).toEqual({ text: '', count: -1.5, cached: false })
  })

  it('lets a later value replace an earlier one and keep its place in the order', () => {
    const harness = start()
    harness.exchange.context.annotate('first', 1)
    harness.exchange.context.annotate('second', 2)
    harness.exchange.context.annotate('first', 3)
    expect(Object.entries(finish(harness).annotations)).toEqual([
      ['first', 3],
      ['second', 2],
    ])
  })

  it('makes the route of the event from what is annotated under route, stringified', () => {
    const harness = start()
    harness.exchange.context.annotate('route', 7)
    expect(finish(harness).route).toBe('7')
  })

  it('keeps the route out of the annotations', () => {
    const harness = start()
    harness.exchange.context.annotate('route', 'ticket')
    expect(finish(harness).annotations).toEqual({})
  })

  it('accepts a name of 32 characters with digits, an underscore and a hyphen', () => {
    const name = `a0_-${'b'.repeat(28)}`
    const harness = start()
    harness.exchange.context.annotate(name, true)
    expect(Object.keys(finish(harness).annotations)).toEqual([name])
  })

  it.each([
    ['an upper-case letter', 'Subject'],
    ['a leading digit', '1st'],
    ['a leading underscore', '_private'],
    ['33 characters', 'a'.repeat(33)],
    ['a space', 'a b'],
    ['a trailing line break', 'subject\n'],
    ['nothing', ''],
    ['no string at all', 7 as unknown as string],
  ])('throws the fixed error for a name with %s', (_title, name) => {
    expect(thrownBy(() => start().exchange.context.annotate(name, 'value'))).toBe(NAME_MESSAGE)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an object', { id: 7 }],
    ['null', null],
    ['undefined', undefined],
    ['a bigint', 7n],
  ])('throws the fixed error for a value that is %s', (_title, value) => {
    expect(thrownBy(() => start().exchange.context.annotate('subject', value as unknown as string))).toBe(VALUE_MESSAGE)
  })

  it('judges the name before the value', () => {
    expect(thrownBy(() => start().exchange.context.annotate('Bad Name', Number.NaN))).toBe(NAME_MESSAGE)
  })

  it('records an annotation made while the signal aborts at the end', () => {
    const harness = start()
    harness.exchange.context.signal.addEventListener('abort', () => harness.exchange.context.annotate('aborted', true))
    harness.res.emit('close')
    expect((harness.events[0] as RequestEvent).annotations).toEqual({ aborted: true })
  })

  it('records nothing once the request event has been emitted', () => {
    const harness = start()
    const event = finish(harness)
    harness.exchange.context.annotate('late', true)
    harness.exchange.context.annotate('route', 'late')
    expect({ route: event.route, annotations: event.annotations, events: harness.events.length }).toEqual({
      route: null,
      annotations: {},
      events: 1,
    })
  })

  it('leaves the place of a later report as it was when the request event was emitted', () => {
    const harness = start()
    finish(harness)
    harness.exchange.context.annotate('route', 'late')
    harness.exchange.context.report('late-fault', new Error('late'))
    expect(harness.events[1]).toEqual({
      type: 'failure',
      code: 'late-fault',
      name: 'Error',
      method: 'GET',
      route: null,
      path: '/tickets/7',
    })
  })

  it('still judges the name once the request event has been emitted', () => {
    const harness = start()
    finish(harness)
    expect(thrownBy(() => harness.exchange.context.annotate('Late', true))).toBe(NAME_MESSAGE)
  })

  it('still judges the value once the request event has been emitted', () => {
    const harness = start()
    finish(harness)
    expect(thrownBy(() => harness.exchange.context.annotate('late', Number.NaN))).toBe(VALUE_MESSAGE)
  })
})

describe('createExchange report and failure', () => {
  it('emits a failure event with the method and the path of a request no route claimed', () => {
    const harness = start({ method: 'POST' })
    harness.exchange.context.report('store-down', new RangeError('the pool is empty'))
    expect(harness.events).toEqual([
      { type: 'failure', code: 'store-down', name: 'RangeError', method: 'POST', route: null, path: '/tickets/7' },
    ])
  })

  it('emits the route in place of the path once a route is annotated', () => {
    const harness = start()
    harness.exchange.context.annotate('route', 'ticket')
    harness.exchange.context.report('store-down', new Error('down'))
    expect(harness.events).toEqual([{ type: 'failure', code: 'store-down', name: 'Error', method: 'GET', route: 'ticket', path: null }])
  })

  it('emits neither a route nor a path for a target that was refused', () => {
    const harness = start({ url: '/a%2Fb' })
    harness.exchange.context.report('store-down', new Error('down'))
    expect(harness.events).toEqual([{ type: 'failure', code: 'store-down', name: 'Error', method: 'GET', route: null, path: null }])
  })

  it('freezes the failure event', () => {
    const harness = start()
    harness.exchange.context.report('store-down', new Error('down'))
    expect(Object.isFrozen(harness.events[0])).toBe(true)
  })

  it.each([
    ['an upper-case word', 'Store-Down'],
    ['a sentence', 'the store is down'],
    ['a doubled hyphen', 'store--down'],
    ['nothing', ''],
    ['no string at all', 500 as unknown as string],
  ])('throws the fixed error for a code that is %s', (_title, code) => {
    expect(thrownBy(() => start().exchange.context.report(code, new Error('down')))).toBe(
      'TypeError: report: the code must be lower-case words joined by hyphens.'
    )
  })

  it('emits nothing for a code it refuses', () => {
    const harness = start()
    thrownBy(() => harness.exchange.context.report('Bad Code', new Error('down')))
    expect(harness.events).toEqual([])
  })

  it.each([
    ['a string', 'down'],
    ['undefined', undefined],
    ['null', null],
    ['a plain object that names itself', { name: 'Chosen' }],
    [
      'an error whose name cannot be read',
      Object.defineProperty(new Error('down'), 'name', {
        get: () => {
          throw new Error('unreadable')
        },
      }),
    ],
  ])('accepts %s as the error and names it unknown', (_title, error) => {
    const harness = start()
    harness.exchange.context.report('store-down', error)
    expect(harness.events.map((event) => (event.type === 'failure' ? event.name : event.type))).toEqual(['unknown'])
  })

  it('still emits after the exchange has ended', () => {
    const harness = start()
    finish(harness)
    harness.exchange.context.report('late-fault', new Error('late'))
    expect(harness.events.map((event) => event.type)).toEqual(['request', 'failure'])
  })

  it('emits a failure the kernel raises under the code it gives', () => {
    const harness = start()
    harness.exchange.failure('stream-failed', new TypeError('a chunk was an object'))
    expect(harness.events).toEqual([
      { type: 'failure', code: 'stream-failed', name: 'TypeError', method: 'GET', route: null, path: '/tickets/7' },
    ])
  })

  it('emits nothing for a failure the kernel raises once an outcome is settled', () => {
    const harness = start()
    harness.exchange.settleOutcome('client-closed')
    harness.exchange.failure('stream-failed', new Error('destroyed by the kernel'))
    expect(harness.events).toEqual([])
  })

  it('still emits what a step reports once an outcome is settled', () => {
    const harness = start()
    harness.exchange.settleOutcome('client-closed')
    harness.exchange.context.report('store-down', new Error('down'))
    expect(harness.events.map((event) => event.type)).toEqual(['failure'])
  })

  it('never puts the message of a reported error in the event', () => {
    const harness = start()
    harness.exchange.context.report('store-down', new Error('marker-in-the-message'))
    expect(JSON.stringify(harness.events)).not.toContain('marker-in-the-message')
  })
})
