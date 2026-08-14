import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from './serve-config'
import type { ServeStep, StaticRequest, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { negotiateEncoding } from './serve-compression'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'

const ROOT = '/site'

const BIG = 'x'.repeat(2048)

interface FakeFile {
  body: string
  mtime: number
}

const fileStats = (size: number, mtime: number, isFile = true): FileStats => ({
  isFile,
  isDirectory: !isFile,
  isSymlink: false,
  size,
  created: new Date(mtime),
  modified: new Date(mtime),
  accessed: new Date(mtime),
  mode: 0o644,
})

// note: An in-memory file map keyed by absolute path; directories exist implicitly through their children.
const fileDeps = (files: Record<string, FakeFile>): ServeStepDeps => ({
  readFile: (filePath) => Buffer.from(files[filePath]?.body ?? ''),
  isFile: (filePath) => files[filePath] !== undefined,
  stat: (filePath) => {
    const file = files[filePath]
    return file === undefined ? null : fileStats(file.body.length, file.mtime)
  },
})

const siteFiles = (): Record<string, FakeFile> => ({
  [`${ROOT}/index.html`]: { body: '<html>home</html>', mtime: 4096 },
  [`${ROOT}/hello.txt`]: { body: 'hello', mtime: 4096 },
  [`${ROOT}/big.txt`]: { body: BIG, mtime: 4096 },
  [`${ROOT}/big.png`]: { body: 'p'.repeat(2048), mtime: 4096 },
  [`${ROOT}/big.json`]: { body: 'j'.repeat(2048), mtime: 4096 },
  [`${ROOT}/big.svg`]: { body: 's'.repeat(2048), mtime: 4096 },
  [`${ROOT}/big.xml`]: { body: 'm'.repeat(2048), mtime: 4096 },
  [`${ROOT}/sub/index.html`]: { body: '<html>sub</html>', mtime: 4096 },
  [`${ROOT}/sub/notes.txt`]: { body: 'notes', mtime: 4096 },
})

const makeConfig = (overrides: Partial<ResolvedServeConfig> = {}): ResolvedServeConfig => ({
  root: ROOT,
  port: 4284,
  headers: [],
  log: false,
  ...overrides,
})

const get = (url: string, headers: StaticRequest['headers'] = {}, method = 'GET'): StaticRequest => ({ method, url, headers })

const serve = (config: ResolvedServeConfig, deps: ServeStepDeps, request: StaticRequest): StaticResponse =>
  runSteps(buildServeSteps(config, deps), request, { config })

// how: The compression step sits at index 1 of the built-ins, just inside the method guard; pairing it with a custom terminal step exercises responses the file step never produces.
const compressionAnd = (terminal: ServeStep): ServeStep[] => [<ServeStep>buildServeSteps(makeConfig(), {})[1], terminal]

const dispatch = (steps: readonly ServeStep[], request: StaticRequest): StaticResponse => runSteps(steps, request, { config: makeConfig() })

describe('buildServeSteps', () => {
  it('assembles the four built-in steps', () => {
    expect(buildServeSteps(makeConfig(), {})).toHaveLength(4)
  })
})

describe('method guard', () => {
  it('answers 405 with an Allow header for a write method', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/', {}, 'POST'))
    expect({
      status: response.status,
      allow: response.headers['Allow'],
      type: response.headers['Content-Type'],
      body: response.body?.toString(),
    }).toEqual({ status: 405, allow: 'GET, HEAD', type: 'text/plain; charset=utf-8', body: 'Method Not Allowed' })
  })

  it('passes a GET through to the file step', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt'))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 200, body: 'hello' })
  })

  it('passes a HEAD through to the file step', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt', {}, 'HEAD'))
    expect({ status: response.status, length: response.headers['Content-Length'] }).toEqual({ status: 200, length: '5' })
  })
})

describe('header rules', () => {
  const serveWith = (rules: ResolvedServeConfig['headers'], request: StaticRequest): StaticResponse =>
    serve(makeConfig({ headers: rules }), fileDeps(siteFiles()), request)

  it('leaves the response untouched when no rules are configured', () => {
    const response = serveWith([], get('/big.png'))
    expect(response.headers).toEqual({ 'Content-Type': 'image/png', 'Content-Length': '2048', ETag: 'W/"800-1000"' })
  })

  it('applies a rule whose prefix matches', () => {
    const response = serveWith([{ prefix: '/sub/', headers: { 'X-Rule': 'prefix' } }], get('/sub/notes.txt'))
    expect(response.headers['X-Rule']).toBe('prefix')
  })

  it('keeps a rule from forging the content encoding', () => {
    const response = serveWith([{ headers: { 'Content-Encoding': 'br' } }], get('/hello.txt'))
    expect(response.headers['Content-Encoding']).toBeUndefined()
  })

  it('keeps a rule from forging the etag', () => {
    // why: A pinned ETag would break both client revalidation and the compression cache's change detection, so the validator stays pipeline-owned.
    const response = serveWith([{ headers: { ETag: '"pinned"' } }], get('/hello.txt'))
    expect(response.headers['ETag']).toBe('W/"5-1000"')
  })

  it('replaces a case-variant header instead of duplicating it', () => {
    const response = serveWith([{ headers: { 'content-type': 'application/json; charset=utf-8' } }], get('/hello.txt'))
    const keys = Object.keys(response.headers).filter((key) => key.toLowerCase() === 'content-type')
    expect({ keys, value: response.headers['content-type'] }).toEqual({ keys: ['content-type'], value: 'application/json; charset=utf-8' })
  })

  it('lets a case-variant content-type rule drive compressibility', () => {
    const response = serveWith(
      [{ suffix: '.png', headers: { 'content-type': 'text/plain; charset=utf-8' } }],
      get('/big.png', { 'accept-encoding': 'br' })
    )
    expect(response.headers['Content-Encoding']).toBe('br')
  })

  it('skips a rule whose prefix misses', () => {
    const response = serveWith([{ prefix: '/sub/', headers: { 'X-Rule': 'prefix' } }], get('/hello.txt'))
    expect(response.headers['X-Rule']).toBeUndefined()
  })

  it('applies a rule whose suffix matches', () => {
    const response = serveWith([{ suffix: '.txt', headers: { 'X-Rule': 'suffix' } }], get('/hello.txt'))
    expect(response.headers['X-Rule']).toBe('suffix')
  })

  it('skips a rule whose suffix misses', () => {
    const response = serveWith([{ suffix: '.txt', headers: { 'X-Rule': 'suffix' } }], get('/big.png'))
    expect(response.headers['X-Rule']).toBeUndefined()
  })

  it('applies a rule bounded on both ends only when both bounds match', () => {
    const rule = { prefix: '/sub/', suffix: '.html', headers: { 'X-Rule': 'both' } }
    const hit = serveWith([rule], get('/sub/'))
    const prefixMiss = serveWith([rule], get('/index.html'))
    const suffixMiss = serveWith([rule], get('/sub/notes.txt'))
    expect({ hit: hit.headers['X-Rule'], prefixMiss: prefixMiss.headers['X-Rule'], suffixMiss: suffixMiss.headers['X-Rule'] }).toEqual({
      hit: 'both',
      prefixMiss: undefined,
      suffixMiss: undefined,
    })
  })

  it('lets a later rule override an earlier one per header', () => {
    const response = serveWith([{ headers: { 'X-A': 'first', 'X-B': 'kept' } }, { headers: { 'X-A': 'second' } }], get('/hello.txt'))
    expect({ a: response.headers['X-A'], b: response.headers['X-B'] }).toEqual({ a: 'second', b: 'kept' })
  })

  it('never lets a rule override the content length', () => {
    const response = serveWith([{ headers: { 'Content-Length': '9999', 'X-Extra': 'on' } }], get('/hello.txt'))
    expect({ length: response.headers['Content-Length'], extra: response.headers['X-Extra'] }).toEqual({ length: '5', extra: 'on' })
  })

  it('matches the resolved file path for a directory url', () => {
    const response = serveWith([{ suffix: '.html', headers: { 'X-Rule': 'resolved' } }], get('/'))
    expect(response.headers['X-Rule']).toBe('resolved')
  })

  it('matches the request path when no file resolved', () => {
    const response = serveWith([{ suffix: '.missing', headers: { 'X-Rule': 'requested' } }], get('/x.missing'))
    expect({ status: response.status, rule: response.headers['X-Rule'] }).toEqual({ status: 404, rule: 'requested' })
  })
})

describe('negotiateEncoding', () => {
  it('returns null for an absent header', () => {
    expect(negotiateEncoding(undefined)).toBeNull()
  })

  it.each<[string, 'br' | 'gzip' | null]>([
    ['gzip, deflate, br', 'br'],
    ['gzip', 'gzip'],
    ['br;q=0, gzip', 'gzip'],
    ['gzip;q=0', null],
    ['*', 'br'],
    ['*;q=0', null],
    ['*, br;q=0', 'gzip'],
    ['br;q=0.5', 'br'],
    ['br;q', 'br'],
    ['br;level=11;q=0', null],
    ['br;Q=0, gzip', 'gzip'],
    [', ,, gzip', 'gzip'],
    ['identity', null],
  ])('negotiates %j to %j', (header, expected) => {
    expect(negotiateEncoding(header)).toBe(expected)
  })
})

describe('compression', () => {
  const acceptAll = { 'accept-encoding': 'gzip, deflate, br' }

  it('skips a HEAD request so the advertised length stays the identity size', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt', acceptAll, 'HEAD'))
    expect({ encoding: response.headers['Content-Encoding'], length: response.headers['Content-Length'] }).toEqual({
      encoding: undefined,
      length: '2048',
    })
  })

  it('skips a non-200 response', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/missing.txt', acceptAll))
    expect({ status: response.status, encoding: response.headers['Content-Encoding'], vary: response.headers['Vary'] }).toEqual({
      status: 404,
      encoding: undefined,
      vary: undefined,
    })
  })

  it('skips a bodiless 200 from a custom step', () => {
    const terminal: ServeStep = () => ({ status: 200, headers: {}, body: null })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ body: response.body, vary: response.headers['Vary'] }).toEqual({ body: null, vary: undefined })
  })

  it('skips a non-compressible type', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.png', acceptAll))
    expect({ encoding: response.headers['Content-Encoding'], vary: response.headers['Vary'] }).toEqual({
      encoding: undefined,
      vary: undefined,
    })
  })

  it('skips a response with no content type', () => {
    const terminal: ServeStep = () => ({ status: 200, headers: {}, body: Buffer.from(BIG) })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ encoding: response.headers['Content-Encoding'], length: response.body?.length }).toEqual({ encoding: undefined, length: 2048 })
  })

  it('honors a no-transform cache control on the inner response', () => {
    const terminal: ServeStep = () => ({
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-transform' },
      body: Buffer.from(BIG),
    })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ encoding: response.headers['Content-Encoding'], length: response.body?.length }).toEqual({ encoding: undefined, length: 2048 })
  })

  it('honors a no-transform set by a header rule', () => {
    const config = makeConfig({ headers: [{ suffix: '.txt', headers: { 'Cache-Control': 'no-transform' } }] })
    const response = runSteps(buildServeSteps(config, fileDeps(siteFiles())), get('/big.txt', acceptAll), { config })
    expect({ encoding: response.headers['Content-Encoding'], length: response.body?.length }).toEqual({ encoding: undefined, length: 2048 })
  })

  it('advertises Vary on a HEAD of a compressible file without touching its length', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt', acceptAll, 'HEAD'))
    expect({
      vary: response.headers['Vary'],
      encoding: response.headers['Content-Encoding'],
      length: response.headers['Content-Length'],
    }).toEqual({
      vary: 'Accept-Encoding',
      encoding: undefined,
      length: '2048',
    })
  })

  it('adds no Vary on a HEAD of a non-compressible file', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.png', acceptAll, 'HEAD'))
    expect(response.headers['Vary']).toBeUndefined()
  })

  it('adds no Vary to a bodiless response that resolves no type', () => {
    // why: A custom step can answer 304 with neither a content type nor a resolved file; an unknowable type must not advertise encoding variance.
    const terminal: ServeStep = () => ({ status: 304, headers: {}, body: null })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ status: response.status, vary: response.headers['Vary'] }).toEqual({ status: 304, vary: undefined })
  })

  it('advertises Vary on a 304 for a compressible file', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt', { ...acceptAll, 'if-none-match': 'W/"800-1000"' }))
    expect({ status: response.status, vary: response.headers['Vary'] }).toEqual({ status: 304, vary: 'Accept-Encoding' })
  })

  it('adds Vary without encoding below the size threshold', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt', acceptAll))
    expect({ vary: response.headers['Vary'], encoding: response.headers['Content-Encoding'], body: response.body?.toString() }).toEqual({
      vary: 'Accept-Encoding',
      encoding: undefined,
      body: 'hello',
    })
  })

  it('adds Vary without encoding when the client accepts neither encoding', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt'))
    expect({ vary: response.headers['Vary'], encoding: response.headers['Content-Encoding'], length: response.body?.length }).toEqual({
      vary: 'Accept-Encoding',
      encoding: undefined,
      length: 2048,
    })
  })

  it('brotli-encodes a large text response and rewrites its length', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt', acceptAll))
    const body = <Buffer>response.body
    expect({
      encoding: response.headers['Content-Encoding'],
      vary: response.headers['Vary'],
      length: response.headers['Content-Length'],
      inflated: brotliDecompressSync(body).toString(),
    }).toEqual({ encoding: 'br', vary: 'Accept-Encoding', length: String(body.length), inflated: BIG })
  })

  it('gzip-encodes when brotli is not accepted', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/big.txt', { 'accept-encoding': 'gzip' }))
    const body = <Buffer>response.body
    expect({
      encoding: response.headers['Content-Encoding'],
      length: response.headers['Content-Length'],
      inflated: gunzipSync(body).toString(),
    }).toEqual({ encoding: 'gzip', length: String(body.length), inflated: BIG })
  })

  it.each([['/big.json'], ['/big.svg'], ['/big.xml']])('treats %s as compressible', (url) => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get(url, acceptAll))
    expect(response.headers['Content-Encoding']).toBe('br')
  })

  it('compresses an application/javascript response from a custom step', () => {
    const terminal: ServeStep = () => ({
      status: 200,
      headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public' },
      body: Buffer.from(BIG),
    })
    const response = dispatch(compressionAnd(terminal), get('/', { 'accept-encoding': 'gzip' }))
    expect({ encoding: response.headers['Content-Encoding'], inflated: gunzipSync(<Buffer>response.body).toString() }).toEqual({
      encoding: 'gzip',
      inflated: BIG,
    })
  })

  it('reuses the cached bytes for a second identical request', () => {
    const config = makeConfig()
    const steps = buildServeSteps(config, fileDeps(siteFiles()))
    const first = runSteps(steps, get('/big.txt', acceptAll), { config })
    const second = runSteps(steps, get('/big.txt', acceptAll), { config })
    expect({ sameBuffer: first.body === second.body, encoding: second.headers['Content-Encoding'] }).toEqual({
      sameBuffer: true,
      encoding: 'br',
    })
  })

  it('recompresses when the file etag changes', () => {
    const config = makeConfig()
    const files = siteFiles()
    const steps = buildServeSteps(config, fileDeps(files))
    const first = runSteps(steps, get('/big.txt', acceptAll), { config })
    files[`${ROOT}/big.txt`] = { body: 'y'.repeat(2048), mtime: 8192 }
    const second = runSteps(steps, get('/big.txt', acceptAll), { config })
    expect({ sameBuffer: first.body === second.body, inflated: brotliDecompressSync(<Buffer>second.body).toString() }).toEqual({
      sameBuffer: false,
      inflated: 'y'.repeat(2048),
    })
  })

  it('compresses fresh each time when the custom response carries no etag', () => {
    const terminal: ServeStep = (_request, context) => {
      context.filePath = `${ROOT}/big.txt`
      return { status: 200, headers: { 'Content-Type': 'text/plain' }, body: Buffer.from(BIG) }
    }
    const steps = compressionAnd(terminal)
    const first = dispatch(steps, get('/', acceptAll))
    const second = dispatch(steps, get('/', acceptAll))
    expect({ sameBuffer: first.body === second.body, equalBytes: (<Buffer>first.body).equals(<Buffer>second.body) }).toEqual({
      sameBuffer: false,
      equalBytes: true,
    })
  })

  it('compresses fresh each time when no file path was resolved', () => {
    const terminal: ServeStep = () => ({ status: 200, headers: { 'Content-Type': 'text/plain', ETag: 'W/"a-b"' }, body: Buffer.from(BIG) })
    const steps = compressionAnd(terminal)
    const first = dispatch(steps, get('/', acceptAll))
    const second = dispatch(steps, get('/', acceptAll))
    expect(first.body === second.body).toBe(false)
  })

  it('adds no content length when the inner response had none', () => {
    const terminal: ServeStep = () => ({ status: 200, headers: { 'Content-Type': 'text/plain' }, body: Buffer.from(BIG) })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ encoding: response.headers['Content-Encoding'], length: response.headers['Content-Length'] }).toEqual({
      encoding: 'br',
      length: undefined,
    })
  })

  it('appends Accept-Encoding to an existing Vary', () => {
    const terminal: ServeStep = () => ({
      status: 200,
      headers: { 'Content-Type': 'text/plain', Vary: 'Origin' },
      body: Buffer.from('tiny'),
    })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect(response.headers['Vary']).toBe('Origin, Accept-Encoding')
  })

  it('leaves a Vary that already covers accept-encoding unchanged', () => {
    const terminal: ServeStep = () => ({
      status: 200,
      headers: { 'Content-Type': 'text/plain', Vary: 'accept-encoding' },
      body: Buffer.from(BIG),
    })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ vary: response.headers['Vary'], encoding: response.headers['Content-Encoding'] }).toEqual({
      vary: 'accept-encoding',
      encoding: 'br',
    })
  })

  it('preserves a lower-case vary key when appending', () => {
    const terminal: ServeStep = () => ({
      status: 200,
      headers: { 'Content-Type': 'text/plain', vary: 'Origin' },
      body: Buffer.from('tiny'),
    })
    const response = dispatch(compressionAnd(terminal), get('/', acceptAll))
    expect({ lower: response.headers['vary'], upper: response.headers['Vary'] }).toEqual({
      lower: 'Origin, Accept-Encoding',
      upper: undefined,
    })
  })
})

describe('serve file step', () => {
  it('answers 400 for a malformed percent-encoding', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/%'))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 400, body: 'Bad Request' })
  })

  it('answers 404 for a dotfile', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/.env'))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('answers 404 for a nested dot directory', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/sub/.git/x'))
    expect(response.status).toBe(404)
  })

  it('answers 404 for the artifact-carried config file in any casing', () => {
    // why: Default macOS and Windows volumes resolve names case-insensitively, so the denial must fold case or the upper-cased spelling serves the config.
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/HF-SERVE.CONFIG.JSON'))
    expect(response.status).toBe(404)
  })

  it('answers 404 for a dotfile behind a backslash separator', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/sub%5C.env'))
    expect(response.status).toBe(404)
  })

  it('answers 404 for the artifact-carried config file', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hf-serve.config.json'))
    expect(response.status).toBe(404)
  })

  it('answers 403 for a traversal attempt', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/../x'))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 403, body: 'Forbidden' })
  })

  it('serves the directory index for the root url', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/'))
    expect({ status: response.status, type: response.headers['Content-Type'], body: response.body?.toString() }).toEqual({
      status: 200,
      type: 'text/html; charset=utf-8',
      body: '<html>home</html>',
    })
  })

  it('serves through a single-dot segment', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/./hello.txt'))
    expect(response.body?.toString()).toBe('hello')
  })

  it('redirects an unslashed directory url to its slashed form', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/sub'))
    expect({ status: response.status, location: response.headers['Location'], body: response.body }).toEqual({
      status: 301,
      location: '/sub/',
      body: null,
    })
  })

  it('keeps the query string on the directory redirect', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/sub?debug=1'))
    expect(response.headers['Location']).toBe('/sub/?debug=1')
  })

  it('answers 404 for a missing file', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/missing.txt'))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('answers 404 when the stat probe reports nothing', () => {
    const deps: ServeStepDeps = { ...fileDeps(siteFiles()), isFile: () => true, stat: () => null }
    const response = serve(makeConfig(), deps, get('/ghost.txt'))
    expect(response.status).toBe(404)
  })

  it('answers 404 when the resolved path is not a file', () => {
    const deps: ServeStepDeps = { ...fileDeps(siteFiles()), isFile: () => true, stat: () => fileStats(0, 0, false) }
    const response = serve(makeConfig(), deps, get('/sub'))
    expect(response.status).toBe(404)
  })

  it('answers 304 with the etag for a matching if-none-match', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt', { 'if-none-match': 'W/"5-1000"' }))
    expect({ status: response.status, etag: response.headers['ETag'], body: response.body }).toEqual({
      status: 304,
      etag: 'W/"5-1000"',
      body: null,
    })
  })

  it.each([['"5-1000"'], ['"stale", W/"5-1000"'], ['*']])('treats the conditional header %j as a match', (header) => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt', { 'if-none-match': header }))
    expect(response.status).toBe(304)
  })

  it('serves the body for a non-matching if-none-match', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt', { 'if-none-match': 'W/"dead-beef"' }))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 200, body: 'hello' })
  })

  it('carries the content type, length, etag, and bytes on a 200', () => {
    const response = serve(makeConfig(), fileDeps(siteFiles()), get('/hello.txt'))
    expect({
      status: response.status,
      type: response.headers['Content-Type'],
      length: response.headers['Content-Length'],
      etag: response.headers['ETag'],
      body: response.body?.toString(),
    }).toEqual({ status: 200, type: 'text/plain; charset=utf-8', length: '5', etag: 'W/"5-1000"', body: 'hello' })
  })
})

describe('default file system', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-serve-steps-'))
    writeFileSync(join(dir, 'index.html'), '<html>DISK</html>')
    writeFileSync(join(dir, 'app.css'), 'body{}')
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'sub', 'index.html'), 'SUB')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves the index from disk when no deps are given', () => {
    const config = makeConfig({ root: dir })
    const response = runSteps(buildServeSteps(config), get('/'), { config })
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 200, body: '<html>DISK</html>' })
  })

  it('serves an asset with its type and length from disk', () => {
    const config = makeConfig({ root: dir })
    const response = runSteps(buildServeSteps(config), get('/app.css'), { config })
    expect({
      status: response.status,
      type: response.headers['Content-Type'],
      length: response.headers['Content-Length'],
      body: response.body?.toString(),
    }).toEqual({
      status: 200,
      type: 'text/css; charset=utf-8',
      length: '6',
      body: 'body{}',
    })
  })

  it('redirects an unslashed directory from disk', () => {
    const config = makeConfig({ root: dir })
    const response = runSteps(buildServeSteps(config), get('/sub'), { config })
    expect({ status: response.status, location: response.headers['Location'] }).toEqual({ status: 301, location: '/sub/' })
  })

  it('answers 404 for a symlink inside the root', () => {
    // why: The confinement check is textual, so a link pointing outside the site is the one way past it — symlinked paths are refused outright, matching the serve package's default.
    const outside = join(dir, '..', `outside-${Date.now()}.txt`)
    writeFileSync(outside, 'secret')
    symlinkSync(outside, join(dir, 'leak.txt'))
    try {
      const config = makeConfig({ root: dir })
      const response = runSteps(buildServeSteps(config), get('/leak.txt'), { config })
      expect(response.status).toBe(404)
    } finally {
      rmSync(outside, { force: true })
    }
  })

  it('answers 304 for the etag the first response advertised', () => {
    const config = makeConfig({ root: dir })
    const steps = buildServeSteps(config)
    const first = runSteps(steps, get('/'), { config })
    const etag = <string>first.headers['ETag']
    const second = runSteps(steps, get('/', { 'if-none-match': etag }), { config })
    expect({ status: second.status, etag: second.headers['ETag'], body: second.body }).toEqual({ status: 304, etag, body: null })
  })

  it('reports a missing file from disk', () => {
    const config = makeConfig({ root: dir })
    const response = runSteps(buildServeSteps(config), get('/missing.js'), { config })
    expect(response.status).toBe(404)
  })
})
