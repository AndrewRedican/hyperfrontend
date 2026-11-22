import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep } from './serve-pipeline'
import type { StaticServeDeps, StaticServerHandle } from './static-serve'
import { createServer, get, STATUS_CODES } from 'node:http'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createServeListener, startStaticServer } from './static-serve'

interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  res: ServerResponse
}

const fakeRes = (): FakeResponse => {
  const state: FakeResponse = { statusCode: 0, headers: {}, body: '', res: {} as ServerResponse }
  state.res = {
    set statusCode(value: number) {
      state.statusCode = value
    },
    get statusCode() {
      return state.statusCode
    },
    setHeader: (key: string, value: string) => {
      state.headers[key] = value
    },
    getHeaderNames: () => Object.keys(state.headers),
    removeHeader: (key: string) => {
      delete state.headers[key]
    },
    end: (chunk?: Buffer | string) => {
      state.body = chunk === undefined ? '' : chunk.toString()
    },
  } as unknown as ServerResponse
  return state
}

const fakeReq = (over: { method?: string; url?: string; headers?: IncomingHttpHeaders } = {}): IncomingMessage =>
  ({ headers: {}, ...over }) as unknown as IncomingMessage

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the pipeline builds, so the served-bytes expectations below compare like for like.
const ROOT = resolve('/site')

// how: The read stub echoes the native path it was handed, so the expected body is joined the way the file step joins it.
const bytesOf = (...segments: string[]): string => `bytes:${join(ROOT, ...segments)}`

const config = (over: Partial<ResolvedServeConfig> = {}): ResolvedServeConfig => ({
  root: ROOT,
  port: 0,
  headers: [],
  log: false,
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

const fsDeps = (): StaticServeDeps => ({
  isFile: () => true,
  stat: () => fileStats(),
  readFile: (path) => Buffer.from(`bytes:${path}`),
})

describe('createServeListener', () => {
  it('writes a GET response body with its headers', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, type: out.headers['Content-Type'], length: out.headers['Content-Length'], body: out.body }).toEqual({
      status: 200,
      type: 'text/javascript; charset=utf-8',
      length: String(bytesOf('app.js').length),
      body: bytesOf('app.js'),
    })
  })

  it('suppresses the body for HEAD while keeping the GET headers', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'HEAD', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, type: out.headers['Content-Type'], length: out.headers['Content-Length'], body: out.body }).toEqual({
      status: 200,
      type: 'text/javascript; charset=utf-8',
      length: String(bytesOf('app.js').length),
      body: '',
    })
  })

  it('ends a bodiless response empty', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET', url: '/app.js', headers: { 'if-none-match': 'W/"5-0"' } }), out.res)
    expect({ status: out.statusCode, etag: out.headers['ETag'], body: out.body }).toEqual({ status: 304, etag: 'W/"5-0"', body: '' })
  })

  it('treats a missing method as GET', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ url: '/app.js' }), out.res)
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 200, body: bytesOf('app.js') })
  })

  it('defaults a missing url to the root index', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET' }), out.res)
    expect(out.body).toBe(bytesOf('index.html'))
  })

  it('lets a custom step answer before the built-ins', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      () => ({ status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('CUSTOM') }),
    ]
    // note: No file-system deps are injected, so a built-in answer for /app.js would be a 404; the CUSTOM body proves the step ran first.
    createServeListener(config(), { steps })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 200, body: 'CUSTOM' })
  })

  it('runs a delegating custom step around the built-in response', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      (_request, _context, next) => {
        const response = next()
        return { ...response, headers: { ...response.headers, 'X-Custom': 'decorated' } }
      },
    ]
    createServeListener(config(), { ...fsDeps(), steps })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, custom: out.headers['X-Custom'], body: out.body }).toEqual({
      status: 200,
      custom: 'decorated',
      body: bytesOf('app.js'),
    })
  })

  it('answers 500 and logs only the error line when a step throws', () => {
    const out = fakeRes()
    const lines: string[] = []
    const steps: readonly ServeStep[] = [
      () => {
        throw new Error('boom')
      },
    ]
    createServeListener(config(), { steps, log: (line) => lines.push(line) })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, body: out.body, lines }).toEqual({ status: 500, body: 'Internal Server Error', lines: ['error boom'] })
  })

  it('stringifies a non-Error throw into the error line', () => {
    const out = fakeRes()
    const lines: string[] = []
    const steps: readonly ServeStep[] = [
      () => {
        // note: A string throw exercises the non-Error logging branch.
        throw 'bang'
      },
    ]
    createServeListener(config(), { steps, log: (line) => lines.push(line) })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, lines }).toEqual({ status: 500, lines: ['error bang'] })
  })

  it('writes an access line per request when logging is enabled', () => {
    const out = fakeRes()
    const lines: string[] = []
    createServeListener(config({ log: true }), { ...fsDeps(), log: (line) => lines.push(line) })(
      fakeReq({ method: 'GET', url: '/app.js?v=2' }),
      out.res
    )
    expect(lines).toEqual(['GET /app.js 200'])
  })

  it('writes no access line when logging is disabled', () => {
    const out = fakeRes()
    const lines: string[] = []
    createServeListener(config(), { ...fsDeps(), log: (line) => lines.push(line) })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect(lines).toEqual([])
  })

  it('serves without a log sink even when logging is enabled and a step throws', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      () => {
        throw new Error('boom')
      },
    ]
    createServeListener(config({ log: true }), { steps })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 500, body: 'Internal Server Error' })
  })

  it('answers 500 when the response itself cannot be written', () => {
    const out = fakeRes()
    let rejected = false
    // why: A setHeader that throws once models Node refusing a header byte; the listener must answer 500 instead of crashing the server.
    const original = out.res.setHeader.bind(out.res)
    out.res.setHeader = ((name: string, value: string) => {
      if (!rejected) {
        rejected = true
        throw new TypeError('Invalid character in header content')
      }
      return original(name, value)
    }) as ServerResponse['setHeader']
    const lines: string[] = []
    createServeListener(config(), { ...fsDeps(), log: (line) => lines.push(line) })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, body: out.body, lines }).toEqual({
      status: 500,
      body: 'Internal Server Error',
      lines: ['error Invalid character in header content'],
    })
  })

  it('stringifies a non-Error write failure into the error line', () => {
    const out = fakeRes()
    out.res.setHeader = (() => {
      // note: A string throw exercises the non-Error logging branch of the write guard.
      throw 'refused'
    }) as ServerResponse['setHeader']
    const lines: string[] = []
    createServeListener(config(), { ...fsDeps(), log: (line) => lines.push(line) })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, lines }).toEqual({ status: 500, lines: ['error refused'] })
  })

  it('sends the failure of a throwing step with the rule headers of its path', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      () => {
        throw new Error('boom')
      },
    ]
    const headers = [{ headers: { 'X-Frame-Options': 'DENY' } }, { prefix: '/private/', headers: { 'X-Area': 'private' } }]
    createServeListener(config({ headers }), { steps })(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, headers: out.headers }).toEqual({
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' },
    })
  })

  it('never lets a cache rule ride the failure of a throwing step', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      () => {
        throw new Error('boom')
      },
    ]
    const headers = [{ prefix: '/assets/', headers: { 'cache-control': 'public, max-age=31536000, immutable' } }]
    createServeListener(config({ headers }), { steps })(fakeReq({ method: 'GET', url: '/assets/app.js' }), out.res)
    expect(out.headers).toEqual({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  })

  it('sends a bare failure when the rules themselves cannot be folded', () => {
    const out = fakeRes()
    // why: A plan built by hand can carry a rule no validator saw; the fold that threw inside the pipeline throws again over the failure.
    const headers = [{ headers: null }] as unknown as ResolvedServeConfig['headers']
    createServeListener(config({ headers }), fsDeps())(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, headers: out.headers, body: out.body }).toEqual({
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Internal Server Error',
    })
  })

  it('drops the headers of a response it could not finish writing', () => {
    const out = fakeRes()
    // why: The entity tag is the third header of a file answer, so the first two are already set when it is refused.
    const original = out.res.setHeader.bind(out.res)
    out.res.setHeader = ((name: string, value: string) => {
      if (name === 'ETag') {
        throw new TypeError('Invalid character in header content')
      }
      return original(name, value)
    }) as ServerResponse['setHeader']
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, headers: out.headers, body: out.body }).toEqual({
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'Internal Server Error',
    })
  })

  it('sends the failure of an unwritable response with the rule headers of its path', () => {
    const out = fakeRes()
    const original = out.res.setHeader.bind(out.res)
    out.res.setHeader = ((name: string, value: string) => {
      if (name === 'ETag') {
        throw new TypeError('Invalid character in header content')
      }
      return original(name, value)
    }) as ServerResponse['setHeader']
    createServeListener(config({ headers: [{ headers: { 'X-Frame-Options': 'DENY' } }] }), fsDeps())(
      fakeReq({ method: 'GET', url: '/app.js' }),
      out.res
    )
    expect(out.headers).toEqual({ 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' })
  })

  it('sends a failure with no header at all when a rule header is what cannot be written', () => {
    const out = fakeRes()
    const original = out.res.setHeader.bind(out.res)
    out.res.setHeader = ((name: string, value: string) => {
      if (name === 'X-Broken') {
        throw new TypeError('Invalid character in header content')
      }
      return original(name, value)
    }) as ServerResponse['setHeader']
    const lines: string[] = []
    createServeListener(config({ headers: [{ headers: { 'X-Broken': 'value' } }] }), { ...fsDeps(), log: (line) => lines.push(line) })(
      fakeReq({ method: 'GET', url: '/app.js' }),
      out.res
    )
    expect({ status: out.statusCode, headers: out.headers, body: out.body, lines }).toEqual({
      status: 500,
      headers: {},
      body: 'Internal Server Error',
      lines: ['error Invalid character in header content'],
    })
  })

  it('clears the reason phrase of a response it could not finish writing', () => {
    const out = fakeRes()
    let refused = false
    // why: Node names the status line when the head is written, which is inside end, and keeps a phrase that is already set; the first end here fails after that point, as a refused trailer does.
    const original = out.res.end.bind(out.res)
    out.res.end = ((chunk?: Buffer | string) => {
      out.res.statusMessage = out.res.statusMessage || (STATUS_CODES[out.res.statusCode] as string)
      if (!refused) {
        refused = true
        throw new TypeError('Trailers are invalid with this transfer encoding')
      }
      return original(chunk)
    }) as ServerResponse['end']
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect(`${out.statusCode} ${out.res.statusMessage}`).toBe('500 Internal Server Error')
  })

  it('survives a socket that rejects even the fallback write', () => {
    const out = fakeRes()
    out.res.setHeader = (() => {
      throw new TypeError('no headers')
    }) as ServerResponse['setHeader']
    out.res.end = (() => {
      throw new Error('socket gone')
    }) as ServerResponse['end']
    const run = (): void => createServeListener(config(), fsDeps())(fakeReq({ method: 'GET', url: '/app.js' }), out.res)
    expect(run).not.toThrow()
  })
})

describe('default file system', () => {
  const tmp = useTempDir({ prefix: 'hf-serve-' })

  beforeEach(() => {
    tmp.write('index.html', 'DISK')
  })

  it('serves a file from disk when no deps are given', () => {
    const out = fakeRes()
    createServeListener(config({ root: tmp.path }))(fakeReq({ method: 'GET', url: '/' }), out.res)
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 200, body: 'DISK' })
  })
})

describe('startStaticServer', () => {
  const tmp = useTempDir({ prefix: 'hf-serve-site-' })
  let handle: StaticServerHandle | undefined

  const bigAsset = `export const filler = "${'a'.repeat(2048)}"\n`

  const fetchRaw = (
    url: string,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> =>
    new Promise((resolve, reject) => {
      get(url, { headers }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
      }).on('error', reject)
    })

  // how: Reads the status line and the framing headers a client is sent, which is where a refused or forged framing shows.
  const fetchFraming = async (
    url: string
  ): Promise<{ line: string; length: string | undefined; framing: string | undefined; trailer: string | undefined }> =>
    new Promise((resolve, reject) => {
      get(url, (res) => {
        res.resume()
        res.on('end', () =>
          resolve({
            line: `${res.statusCode} ${res.statusMessage}`,
            length: res.headers['content-length'],
            framing: res.headers['transfer-encoding'],
            trailer: res.headers['trailer'],
          })
        )
      }).on('error', reject)
    })

  // how: Answers with a length and a trailer together, which Node accepts header by header and refuses when it writes the head.
  const unframeable: ServeStep = () => ({ status: 200, headers: { 'Content-Length': '2', Trailer: 'X-Checksum' }, body: Buffer.from('ok') })

  beforeEach(() => {
    tmp.write('index.html', 'DISK')
    tmp.write('big.js', bigAsset)
  })

  afterEach(async () => {
    await handle?.close()
    handle = undefined
  })

  it('serves the site over a real socket on an OS-assigned port', async () => {
    handle = await startStaticServer(config({ root: tmp.path }))
    const response = await fetchRaw(handle.url)
    expect({ url: handle.url, status: response.status, body: response.body.toString() }).toEqual({
      url: `http://localhost:${handle.port}/`,
      status: 200,
      body: 'DISK',
    })
  })

  it('reports the configured host in the handle url', async () => {
    handle = await startStaticServer(config({ root: tmp.path, host: '127.0.0.1' }))
    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}/`)
  })

  it('binds the configured host', async () => {
    handle = await startStaticServer(config({ root: tmp.path, host: '127.0.0.1' }))
    await expect(fetchRaw(`http://127.0.0.1:${handle.port}/`)).resolves.toEqual(expect.objectContaining({ status: 200 }))
  })

  it('reports localhost for a wildcard bind', async () => {
    handle = await startStaticServer(config({ root: tmp.path, host: '0.0.0.0' }))
    expect(handle.url).toBe(`http://localhost:${handle.port}/`)
  })

  it('compresses a large asset end-to-end for a gzip client', async () => {
    handle = await startStaticServer(config({ root: tmp.path }))
    const response = await fetchRaw(`${handle.url}big.js`, { 'accept-encoding': 'gzip' })
    expect({
      status: response.status,
      encoding: response.headers['content-encoding'],
      vary: response.headers['vary'],
      body: gunzipSync(response.body).toString(),
    }).toEqual({ status: 200, encoding: 'gzip', vary: 'Accept-Encoding', body: bigAsset })
  })

  it.each([
    ['a trailer', { Trailer: 'X-Checksum' }],
    ['a chunked transfer encoding', { 'Transfer-Encoding': 'chunked' }],
    ['a transfer coding that was never applied', { 'transfer-encoding': 'gzip' }],
  ])('serves a file under its own length when a rule names %s', async (_label: string, headers: Record<string, string>) => {
    handle = await startStaticServer(config({ root: tmp.path, headers: [{ headers }] }))
    await expect(fetchFraming(`${handle.url}index.html`)).resolves.toEqual({
      line: '200 OK',
      length: '4',
      framing: undefined,
      trailer: undefined,
    })
  })

  it('names the failure in the status line of a response Node refused while writing its head', async () => {
    handle = await startStaticServer(config({ root: tmp.path }), { steps: [unframeable] })
    await expect(fetchFraming(handle.url)).resolves.toEqual(expect.objectContaining({ line: '500 Internal Server Error' }))
  })

  it('names the failure in the status line of the bare answer too', async () => {
    // why: A plan built by hand can carry a header value no validator saw, which Node refuses on the failure answer as well.
    handle = await startStaticServer(config({ root: tmp.path, headers: [{ headers: { 'X-Broken': 'caf\u0113' } }] }), {
      steps: [unframeable],
    })
    await expect(fetchFraming(handle.url)).resolves.toEqual(expect.objectContaining({ line: '500 Internal Server Error' }))
  })

  it('uses an injected server factory', async () => {
    handle = await startStaticServer(config({ root: tmp.path }), { createServer: (handler) => createServer(handler) })
    await expect(fetchRaw(handle.url)).resolves.toEqual(expect.objectContaining({ status: 200 }))
  })

  it('stops serving after close', async () => {
    handle = await startStaticServer(config({ root: tmp.path }))
    const url = handle.url
    await handle.close()
    handle = undefined
    await expect(fetchRaw(url)).rejects.toThrow()
  })
})
