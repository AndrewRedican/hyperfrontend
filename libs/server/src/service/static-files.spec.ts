import type { IncomingHttpHeaders } from 'node:http'
import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep, ServeStepContext, StaticRequest } from '../static/serve-pipeline'
import type { ServeStepDeps } from '../static/serve-steps'
import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from '@hyperfrontend/testing'
import { runSteps } from '../static/serve-pipeline'
import { buildServeSteps } from '../static/serve-steps'
import { settle } from './pipeline'
import { staticFiles } from './static-files'

/** What a spec asserts on after one request went through the mount. */
interface Seen {
  /** The status of the response. */
  readonly status: number
  /** The headers of the response. */
  readonly headers: Readonly<Record<string, string>>
  /** The body of the response as text, or `null`. */
  readonly body: string | null
  /** How many times the mount called `next`. */
  readonly delegated: number
  /** Every `report` call, in order. */
  readonly reports: unknown[][]
}

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the pipeline builds, so the served-bytes expectations below compare like for like.
const ROOT = resolve('/site')

/**
 * Names the bytes the read stub answers for a file of the fixture site.
 *
 * @param segments - Where the file sits below the root.
 * @returns The text the stub serves for it, joined the way the file step joins the path.
 */
const bytesOf = (...segments: string[]): string => `bytes:${join(ROOT, ...segments)}`

/**
 * Builds a resolved serving plan for the fixture site.
 *
 * @param over - Fields that replace the defaults.
 * @returns The plan: no header rule, and a port, a host and a log flag a mount has no use for.
 */
const configOf = (over: Partial<ResolvedServeConfig> = {}): ResolvedServeConfig => ({
  root: ROOT,
  port: 4000,
  host: '203.0.113.9',
  headers: [],
  log: true,
  ...over,
})

// note: A fixed size and epoch mtime pin the weak ETag every serving test can predict: W/"5-0".
const fileStats = (): FileStats => ({
  isFile: true,
  isDirectory: false,
  isSymlink: false,
  size: 5,
  created: new Date(0),
  modified: new Date(0),
  accessed: new Date(0),
  mode: 0o644,
})

/**
 * Builds file boundaries that answer from values, so no spec reads a disk.
 *
 * @param present - Tells whether a path is a file of the fixture site; every path when omitted.
 * @returns The four boundaries of the built-in serve steps.
 */
const fileDeps = (present: (filePath: string) => boolean = () => true): Required<ServeStepDeps> => ({
  isFile: present,
  stat: (filePath) => (present(filePath) ? fileStats() : null),
  readFile: (filePath) => Buffer.from(`bytes:${filePath}`),
  realPath: (filePath) => filePath,
})

/**
 * Builds a request the way the listener does: frozen, with lower-cased headers in an object without a prototype.
 *
 * @param method - GET, POST and so on, as Node hands it over.
 * @param raw - The target as the client sent it.
 * @param headers - The request headers, names in lower case.
 * @returns The frozen request.
 */
const requestFor = (method: string, raw: string, headers: IncomingHttpHeaders = {}): ServiceRequest =>
  Object.freeze({
    method,
    url: raw,
    headers: Object.freeze(Object.assign(Object.create(null), headers)),
    path: raw.split('?')[0],
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest

/**
 * Runs the mount behind the boundary the listener puts around a pipeline and gathers what a spec asserts on.
 *
 * @param step - The mount under test.
 * @param request - The request sent through it.
 * @returns The response in plain values, the number of delegations and the reports.
 */
const seen = async (step: Step, request: ServiceRequest): Promise<Seen> => {
  const reports: unknown[][] = []
  let delegated = 0
  const context: BaseContext = Object.freeze({
    signal: new AbortController().signal,
    client: Object.freeze({ address: '192.0.2.7' }),
    annotate: () => undefined,
    report: (code: string, error: unknown) => void reports.push([code, error]),
  })
  const next = (): Promise<ServiceResponse> => ((delegated += 1), Promise.resolve({ status: 404, headers: {}, body: null }))
  const response = await settle(() => step(request, context, next), context)
  return {
    status: response.status,
    headers: response.headers,
    body: response.body === null ? null : response.body.toString(),
    delegated,
    reports,
  }
}

/**
 * Calls the mount directly, as a pipeline does, with a `next` that fails the spec when it is called.
 *
 * @param step - The mount under test.
 * @param request - The request sent through it.
 * @returns What the mount returned, as it returned it.
 */
const call = (step: Step, request: ServiceRequest): unknown =>
  step(request, {} as BaseContext, () => Promise.reject(new Error('the mount delegated')))

describe('staticFiles', () => {
  it('serves a file through the injected file boundaries, with the headers of the static chain', async () => {
    expect(await seen(staticFiles(configOf(), fileDeps()), requestFor('GET', '/app.js'))).toEqual({
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(bytesOf('app.js').length),
        ETag: 'W/"5-0"',
        Vary: 'Accept-Encoding',
      },
      body: bytesOf('app.js'),
      delegated: 0,
      reports: [],
    })
  })

  it('answers exactly what the static chain answers for the same request', () => {
    const config = configOf({ headers: [{ suffix: '.js', headers: { 'Cache-Control': 'max-age=60' } }] })
    const request: StaticRequest = { method: 'GET', url: '/app.js', headers: {} }
    expect(call(staticFiles(config, fileDeps()), requestFor('GET', '/app.js'))).toEqual(
      runSteps(buildServeSteps(config, fileDeps()), request, { config })
    )
  })

  it('answers synchronously, with the response of the static chain unwrapped', () => {
    expect(call(staticFiles(configOf(), fileDeps()), requestFor('GET', '/app.js'))).toEqual({
      status: 200,
      headers: expect.any(Object),
      body: Buffer.from(bytesOf('app.js')),
    })
  })

  it('answers HEAD with the headers of a GET, leaving the body to the listener', async () => {
    const { status, headers } = await seen(staticFiles(configOf(), fileDeps()), requestFor('HEAD', '/app.js'))
    expect({ status, headers }).toEqual({
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(bytesOf('app.js').length),
        ETag: 'W/"5-0"',
        Vary: 'Accept-Encoding',
      },
    })
  })

  it('answers a conditional request 304 without a body', async () => {
    const { status, headers, body } = await seen(
      staticFiles(configOf(), fileDeps()),
      requestFor('GET', '/app.js', { 'if-none-match': 'W/"5-0"' })
    )
    expect({ status, headers, body }).toEqual({ status: 304, headers: { ETag: 'W/"5-0"', Vary: 'Accept-Encoding' }, body: null })
  })

  it('refuses POST with the 405 of the static method guard', async () => {
    const { status, headers, body } = await seen(staticFiles(configOf(), fileDeps()), requestFor('POST', '/app.js'))
    expect({ status, headers, body }).toEqual({
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' },
      body: 'Method Not Allowed',
    })
  })

  it('answers 404 itself for a file the site does not have, and never delegates', async () => {
    const { status, delegated } = await seen(
      staticFiles(
        configOf(),
        fileDeps(() => false)
      ),
      requestFor('GET', '/missing.js')
    )
    expect({ status, delegated }).toEqual({ status: 404, delegated: 0 })
  })

  it('serves the index of a directory target', async () => {
    expect((await seen(staticFiles(configOf(), fileDeps()), requestFor('GET', '/docs/'))).body).toBe(bytesOf('docs', 'index.html'))
  })

  it('reads the raw target, so a query does not reach the file path', async () => {
    expect((await seen(staticFiles(configOf(), fileDeps()), requestFor('GET', '/app.js?v=2'))).body).toBe(bytesOf('app.js'))
  })

  it('applies the header rules of the config', async () => {
    const config = configOf({ headers: [{ suffix: '.js', headers: { 'Cache-Control': 'max-age=60' } }] })
    expect((await seen(staticFiles(config, fileDeps()), requestFor('GET', '/app.js'))).headers['Cache-Control']).toBe('max-age=60')
  })

  it.each([['Connection'], ['Keep-Alive'], ['Upgrade'], ['TE']])(
    'serves a file under a config rule that names %s, which the fold leaves out',
    async (name) => {
      const config = configOf({ headers: [{ headers: { [name]: 'close', 'Cache-Control': 'max-age=60' } }] })
      const { status, headers, reports } = await seen(staticFiles(config, fileDeps()), requestFor('GET', '/app.js'))
      expect({ status, named: name in headers, lifetime: headers['Cache-Control'], reports }).toEqual({
        status: 200,
        named: false,
        lifetime: 'max-age=60',
        reports: [],
      })
    }
  )

  it('refuses POST under a config rule that names a connection header with the 405 of the method guard', async () => {
    const config = configOf({ headers: [{ headers: { Connection: 'close' } }] })
    expect((await seen(staticFiles(config, fileDeps()), requestFor('POST', '/app.js'))).status).toBe(405)
  })

  it('compresses a large asset for a client that accepts gzip', async () => {
    const asset = 'export const value = 1\n'.repeat(400)
    const deps = { ...fileDeps(), readFile: () => Buffer.from(asset) }
    const response = (await call(
      staticFiles(configOf(), deps),
      requestFor('GET', '/big.js', { 'accept-encoding': 'gzip' })
    )) as ServiceResponse
    expect({ encoding: response.headers['Content-Encoding'], body: gunzipSync(response.body as Buffer).toString() }).toEqual({
      encoding: 'gzip',
      body: asset,
    })
  })

  it('hands the static chain the method, the raw target and the very headers of the request', () => {
    const received: StaticRequest[] = []
    const record: ServeStep = (request, _context, next) => (received.push(request), next())
    const request = requestFor('GET', '/app.js?v=2', { accept: 'text/javascript' })
    call(staticFiles(configOf(), { ...fileDeps(), steps: [record] }), request)
    expect({ received, sameHeaders: received[0]?.headers === request.headers }).toEqual({
      received: [{ method: 'GET', url: '/app.js?v=2', headers: request.headers }],
      sameHeaders: true,
    })
  })

  it('runs custom steps ahead of the built-in ones', async () => {
    const steps: readonly ServeStep[] = [
      () => ({ status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('CUSTOM') }),
    ]
    const { status, body } = await seen(staticFiles(configOf(), { ...fileDeps(() => false), steps }), requestFor('POST', '/app.js'))
    expect({ status, body }).toEqual({ status: 200, body: 'CUSTOM' })
  })

  it('lets a custom step decorate what the built-in steps answer', async () => {
    const decorate: ServeStep = (_request, _context, next) => {
      const response = next()
      return { ...response, headers: { ...response.headers, 'X-Custom': 'decorated' } }
    }
    const { headers, body } = await seen(staticFiles(configOf(), { ...fileDeps(), steps: [decorate] }), requestFor('GET', '/app.js'))
    expect({ custom: headers['X-Custom'], body }).toEqual({ custom: 'decorated', body: bytesOf('app.js') })
  })

  it('gives each request a context of its own, so the file one request resolved is unknown to the next', () => {
    const before: (string | undefined)[] = []
    const contexts: ServeStepContext[] = []
    const record: ServeStep = (_request, context, next) => (before.push(context.filePath), contexts.push(context), next())
    const step = staticFiles(configOf(), { ...fileDeps(), steps: [record] })
    call(step, requestFor('GET', '/app.js'))
    call(step, requestFor('GET', '/app.js'))
    expect({ before, distinct: contexts[0] !== contexts[1], resolved: contexts.map((context) => context.filePath) }).toEqual({
      before: [undefined, undefined],
      distinct: true,
      resolved: [join(ROOT, 'app.js'), join(ROOT, 'app.js')],
    })
  })

  it('gives the static chain the config it was mounted with', () => {
    const contexts: ServeStepContext[] = []
    const record: ServeStep = (_request, context, next) => (contexts.push(context), next())
    const config = configOf()
    call(staticFiles(config, { ...fileDeps(), steps: [record] }), requestFor('GET', '/app.js'))
    expect(contexts[0]?.config).toBe(config)
  })

  it('lets the throw of a synchronous step leave the mount', () => {
    const fault = new Error('disk gone')
    const failing: ServeStep = () => {
      throw fault
    }
    const step = staticFiles(configOf(), { ...fileDeps(), steps: [failing] })
    let thrown: unknown
    try {
      call(step, requestFor('GET', '/app.js'))
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBe(fault)
  })

  it('has a throwing step answered 500 and reported at the boundary around the mount', async () => {
    const fault = new Error('disk gone')
    const failing: ServeStep = () => {
      throw fault
    }
    const { status, reports } = await seen(staticFiles(configOf(), { ...fileDeps(), steps: [failing] }), requestFor('GET', '/app.js'))
    expect({ status, reports }).toEqual({ status: 500, reports: [['step-failed', fault]] })
  })

  it('builds its steps once, so a custom step added later never runs', () => {
    const steps: ServeStep[] = []
    const step = staticFiles(configOf(), { ...fileDeps(), steps })
    steps.push(() => ({ status: 200, headers: {}, body: Buffer.from('LATE') }))
    expect(call(step, requestFor('GET', '/app.js'))).toMatchObject({ body: Buffer.from(bytesOf('app.js')) })
  })

  it('mounts without deps, where the method guard answers before any file is looked up', async () => {
    expect((await seen(staticFiles(configOf()), requestFor('DELETE', '/app.js'))).status).toBe(405)
  })
})
