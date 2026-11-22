import type { IncomingMessage, RequestListener, Server, ServerOptions, ServerResponse } from 'node:http'
import type { ServiceClock } from './clock'
import type { ServiceResponse, Step } from './contract'
import type { ServiceEvent } from './events'
import type { ServiceHandle, ServiceOptions } from './service'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { startService } from './service'

/** The fake server: it records what `startService` does to it and binds or refuses as a spec tells it to. */
interface FakeServer extends EventEmitter {
  /** Every call in order, the clock's among them: the method, then its arguments. */
  readonly calls: unknown[][]
  /** How many listeners each event had at the moment `listen` was called. */
  readonly listenersAtBind: Record<string, number>
  /** The callback `close` was given, which a spec calls when every connection is gone. */
  closed: () => void
}

/** A service started over fakes and everything around it a spec drives or reads. */
interface Harness {
  /** The fake server. */
  readonly server: FakeServer
  /** Every options object and handler `createServer` was called with. */
  readonly created: [ServerOptions, RequestListener][]
  /** Every event the sink received. */
  readonly events: ServiceEvent[]
  /** The fake clock, which records its calls in the server's list and never fires a timer. */
  readonly clock: ServiceClock
  /** Creates the fake server, recording what it was given. */
  createServer(options: ServerOptions, handler: RequestListener): Server
  /** Starts a service over the fakes. */
  start(options?: Record<string, unknown>): Promise<ServiceHandle>
}

/**
 * Stands in for a handler that never answers, so that nothing is written to a fake response.
 *
 * @returns A promise that never settles.
 */
const never = (): Promise<ServiceResponse> => new Promise<ServiceResponse>(() => undefined)

const pending: Step = () => never()

/**
 * Builds a fake server, a fake clock and a recording sink for one service.
 *
 * @param steps - The pipeline the service runs.
 * @param bindError - What the bind fails with, or `undefined` for a bind that succeeds on port 4321.
 * @returns The fakes and a function that starts the service over them.
 */
const prepare = (steps: readonly Step[] = [pending], bindError?: Error): Harness => {
  const calls: unknown[][] = []
  const listenersAtBind: Record<string, number> = {}
  const server: FakeServer = Object.assign(new EventEmitter(), {
    calls,
    listenersAtBind,
    closed: () => undefined,
    address: () => ({ port: 4321 }),
    close: (callback: () => void) => {
      calls.push(['close'])
      server.closed = callback
    },
    listen: (...given: unknown[]) => {
      const bound = given.pop() as () => void
      calls.push(['listen', ...given])
      for (const name of ['checkContinue', 'connection', 'clientError', 'error']) {
        listenersAtBind[name] = server.listenerCount(name)
      }
      queueMicrotask(() => (bindError === undefined ? bound() : void server.emit('error', bindError)))
    },
  })
  const created: [ServerOptions, RequestListener][] = []
  const events: ServiceEvent[] = []
  const clock: ServiceClock = {
    now: () => 0,
    setTimeout: (_callback: () => void, ms: number) => calls.push(['setTimeout', ms]),
    clearTimeout: () => void calls.push(['clearTimeout']),
  }
  const createServer = (options: ServerOptions, handler: RequestListener): Server => {
    created.push([options, handler])
    return server as unknown as Server
  }
  const start = (options: Record<string, unknown> = {}): Promise<ServiceHandle> =>
    startService({ steps, port: 8080, ...options } as ServiceOptions, { createServer, clock, report: (event) => void events.push(event) })
  return { server, created, events, clock, createServer, start }
}

/**
 * Builds a socket that records what is done to it.
 *
 * @returns The fake socket and the list of calls made on it.
 */
const fakeSocket = (): EventEmitter & { readonly calls: unknown[][] } => {
  const calls: unknown[][] = []
  return Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    writable: true,
    bytesRead: 12,
    destroyed: false,
    calls,
    write: (text: string) => void calls.push(['write', text]),
    destroySoon: () => void calls.push(['destroy']),
    destroy: () => void calls.push(['destroy']),
  })
}

/**
 * Delivers one fake request.
 *
 * @param deliver - How the request reaches the service: a handler, or an event of the fake server.
 * @param url - The raw request target.
 * @returns The names of the methods called on the fake response.
 */
const deliverRequest = (deliver: RequestListener, url: string): string[] => {
  const called: string[] = []
  const req = Object.assign(new PassThrough(), { method: 'POST', url, headers: {}, complete: true, socket: fakeSocket() })
  const res = Object.assign(new EventEmitter(), { headersSent: false, writeContinue: () => void called.push('writeContinue') })
  deliver(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  return called
}

/**
 * Describes how a promise settled.
 *
 * @param promise - The promise under test.
 * @returns The message of the error it rejected with, or `resolved`.
 */
const outcomeOf = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => 'resolved',
    (error: Error) => error.message
  )

describe('startService', () => {
  describe('server', () => {
    it('hands the three Node timeouts and the checking interval to createServer', async () => {
      const harness = prepare()
      await harness.start()
      expect(harness.created.map(([options]) => options)).toEqual([
        { headersTimeout: 10000, requestTimeout: 60000, keepAliveTimeout: 5000, connectionsCheckingInterval: 5000 },
      ])
    })

    it('hands the timeouts a service set, and checks no more seldom than the header time', async () => {
      const harness = prepare()
      await harness.start({ headersTimeoutMs: 300, requestTimeoutMs: 900, keepAliveTimeoutMs: 70 })
      expect(harness.created.map(([options]) => options)).toEqual([
        { headersTimeout: 300, requestTimeout: 900, keepAliveTimeout: 70, connectionsCheckingInterval: 300 },
      ])
    })

    it('hands createServer the handler that runs the steps', async () => {
      const seen: string[] = []
      const harness = prepare([(request) => (seen.push(request.path), never())])
      await harness.start()
      deliverRequest(harness.created[0]?.[1] as RequestListener, '/from-handler')
      expect(seen).toEqual(['/from-handler'])
    })

    it('runs the steps it was started with, whatever becomes of the list afterwards', async () => {
      const seen: string[] = []
      const steps: Step[] = [() => (seen.push('started with'), never())]
      const harness = prepare(steps)
      await harness.start()
      steps.unshift(() => (seen.push('added later'), never()))
      deliverRequest(harness.created[0]?.[1] as RequestListener, '/')
      expect(seen).toEqual(['started with'])
    })

    it('attaches the checkContinue, connection and clientError listeners before the bind', async () => {
      const harness = prepare()
      await harness.start()
      expect(harness.server.listenersAtBind).toEqual({ checkContinue: 1, connection: 1, clientError: 1, error: 1 })
    })

    it('attaches its own error listener once the bind has released its own', async () => {
      const harness = prepare()
      await harness.start()
      expect(harness.server.listenerCount('error')).toBe(1)
    })

    it('reports an error of the server after the bind as a server-error failure', async () => {
      const harness = prepare()
      await harness.start()
      harness.server.emit('error', Object.assign(new RangeError('accept EMFILE'), { code: 'EMFILE' }))
      expect(harness.events).toEqual([{ type: 'failure', code: 'server-error', name: 'RangeError', method: null, route: null, path: null }])
    })

    it('runs the steps for a request that arrives through checkContinue, answering 100 Continue at its first read', async () => {
      const harness = prepare([(request) => (void request.body.bytes(), never())])
      await harness.start()
      expect(deliverRequest((req, res) => void harness.server.emit('checkContinue', req, res), '/upload')).toEqual(['writeContinue'])
    })

    it('answers no 100 Continue for a request that arrives through request', async () => {
      const harness = prepare([(request) => (void request.body.bytes(), never())])
      await harness.start()
      expect(deliverRequest(harness.created[0]?.[1] as RequestListener, '/upload')).toEqual([])
    })

    it('answers a client error of the server on its socket', async () => {
      const harness = prepare()
      await harness.start()
      const socket = fakeSocket()
      harness.server.emit('clientError', Object.assign(new Error('overflow'), { code: 'HPE_HEADER_OVERFLOW' }), socket)
      expect(socket.calls).toEqual([
        ['write', 'HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'],
        ['destroy'],
      ])
    })
  })

  describe('bind', () => {
    it('binds the port and the host', async () => {
      const harness = prepare()
      await harness.start({ port: 8081, host: '127.0.0.1' })
      expect(harness.server.calls).toEqual([['listen', 8081, '127.0.0.1']])
    })

    it('binds every interface without a host', async () => {
      const harness = prepare()
      await harness.start({ port: 0 })
      expect(harness.server.calls).toEqual([['listen', 0]])
    })

    it('reports the port actually bound', async () => {
      expect((await prepare().start({ port: 0 })).port).toBe(4321)
    })

    it.each([
      [undefined, 'http://localhost:4321/'],
      ['0.0.0.0', 'http://127.0.0.1:4321/'],
      ['::', 'http://localhost:4321/'],
      ['service.internal', 'http://service.internal:4321/'],
      ['127.0.0.1', 'http://127.0.0.1:4321/'],
      ['::1', 'http://[::1]:4321/'],
    ])('gives a service bound to %p the URL %s', async (host, url) => {
      expect((await prepare().start({ host })).url).toBe(url)
    })

    it('returns a frozen handle', async () => {
      expect(Object.isFrozen(await prepare().start())).toBe(true)
    })

    it('rejects with the bind error when the port cannot be taken', async () => {
      const refused = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' })
      expect(
        await prepare([pending], refused)
          .start()
          .catch((error: unknown) => error)
      ).toBe(refused)
    })

    it('attaches no error listener to a server that failed to bind', async () => {
      const harness = prepare([pending], new Error('listen EACCES'))
      await outcomeOf(harness.start())
      expect(harness.server.listenerCount('error')).toBe(0)
    })
  })

  describe('invalid options', () => {
    it('rejects with one error that names every problem', async () => {
      expect(await outcomeOf(prepare().start({ port: -1, graceMs: 0.5 }))).toBe(
        'Invalid service options:\n  - "port" must be an integer between 0 and 65535.\n  - "graceMs" must be a non-negative integer.'
      )
    })

    it('creates no server', async () => {
      const harness = prepare()
      await outcomeOf(harness.start({ steps: 'not steps' }))
      expect(harness.created).toEqual([])
    })
  })

  describe('close', () => {
    it('stops accepting, then drains with the configured grace', async () => {
      const harness = prepare()
      const handle = await harness.start({ graceMs: 321 })
      void handle.close()
      expect(harness.server.calls.slice(1)).toEqual([['close'], ['setTimeout', 321], ['clearTimeout']])
    })

    it('drains with the default grace when none is set', async () => {
      const harness = prepare()
      const handle = await harness.start()
      void handle.close()
      expect(harness.server.calls).toContainEqual(['setTimeout', 10000])
    })

    it('stays pending until the server has closed', async () => {
      const handle = await prepare().start()
      let state = 'pending'
      void handle.close().then(() => (state = 'closed'))
      await flushPromises()
      expect(state).toBe('pending')
    })

    it('resolves once the server has closed', async () => {
      const harness = prepare()
      const handle = await harness.start()
      const closing = outcomeOf(handle.close())
      harness.server.closed()
      expect(await closing).toBe('resolved')
    })

    it('stays pending while a connection is open, although the server has closed', async () => {
      const harness = prepare()
      const handle = await harness.start()
      harness.server.emit('connection', fakeSocket())
      let state = 'pending'
      void handle.close().then(() => (state = 'closed'))
      harness.server.closed()
      await flushPromises()
      expect(state).toBe('pending')
    })

    it('resolves once the server has closed and its connections have gone', async () => {
      const harness = prepare()
      const handle = await harness.start()
      const socket = fakeSocket()
      harness.server.emit('connection', socket)
      const closing = outcomeOf(handle.close())
      socket.emit('close')
      harness.server.closed()
      expect(await closing).toBe('resolved')
    })

    it('destroys an idle connection at once', async () => {
      const harness = prepare()
      const handle = await harness.start()
      const socket = fakeSocket()
      harness.server.emit('connection', socket)
      void handle.close()
      expect(socket.calls).toEqual([['destroy']])
    })

    it('returns the same promise on every call', async () => {
      const handle = await prepare().start()
      expect(handle.close()).toBe(handle.close())
    })

    it('closes the server once however often it is called', async () => {
      const harness = prepare()
      const handle = await harness.start()
      void handle.close()
      void handle.close()
      expect(harness.server.calls.filter(([method]) => method === 'close')).toEqual([['close']])
    })

    it('arms and clears the grace timer on the system clock when no clock is injected', async () => {
      const harness = prepare()
      // why: one millisecond of real time is the longest this timer can stay pending, whatever the outcome of the test
      const handle = await startService({ steps: [pending], port: 8080, graceMs: 1 }, { createServer: harness.createServer })
      const closing = outcomeOf(handle.close())
      harness.server.closed()
      expect(await closing).toBe('resolved')
    })
  })
})
