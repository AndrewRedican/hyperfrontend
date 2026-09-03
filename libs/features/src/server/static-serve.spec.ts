import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from './serve-config'
import type { ServeStep } from './serve-pipeline'
import type { StaticServeDeps, StaticServerHandle } from './static-serve'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, get } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from '@hyperfrontend/testing'
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
    end: (chunk?: Buffer | string) => {
      state.body = chunk === undefined ? '' : chunk.toString()
    },
  } as unknown as ServerResponse
  return state
}

const fakeReq = (over: { method?: string; url?: string; headers?: IncomingHttpHeaders } = {}): IncomingMessage =>
  ({ headers: {}, ...over }) as unknown as IncomingMessage

const config = (over: Partial<ResolvedServeConfig> = {}): ResolvedServeConfig => ({
  root: '/site',
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
      length: '18',
      body: 'bytes:/site/app.js',
    })
  })

  it('suppresses the body for HEAD while keeping the GET headers', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'HEAD', url: '/app.js' }), out.res)
    expect({ status: out.statusCode, type: out.headers['Content-Type'], length: out.headers['Content-Length'], body: out.body }).toEqual({
      status: 200,
      type: 'text/javascript; charset=utf-8',
      length: '18',
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
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 200, body: 'bytes:/site/app.js' })
  })

  it('defaults a missing url to the root index', () => {
    const out = fakeRes()
    createServeListener(config(), fsDeps())(fakeReq({ method: 'GET' }), out.res)
    expect(out.body).toBe('bytes:/site/index.html')
  })

  it('lets a custom step answer before the built-ins', () => {
    const out = fakeRes()
    const steps: readonly ServeStep[] = [
      () => ({ status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('CUSTOM') }),
    ]
    // note: No file-system deps are injected, so a built-in answer for /app.js would be a 404 — the CUSTOM body proves the step ran first.
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
      body: 'bytes:/site/app.js',
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

  it('answers a raw 500 when the response itself cannot be written', () => {
    const out = fakeRes()
    let rejected = false
    // why: A setHeader that throws once models Node refusing a header byte; the listener must fall back to a bare 500 instead of crashing the server.
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
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-serve-'))
    writeFileSync(join(dir, 'index.html'), 'DISK')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves a file from disk when no deps are given', () => {
    const out = fakeRes()
    createServeListener(config({ root: dir }))(fakeReq({ method: 'GET', url: '/' }), out.res)
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 200, body: 'DISK' })
  })
})

describe('startStaticServer', () => {
  let dir: string
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

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-serve-site-'))
    writeFileSync(join(dir, 'index.html'), 'DISK')
    writeFileSync(join(dir, 'big.js'), bigAsset)
  })

  afterEach(async () => {
    await handle?.close()
    handle = undefined
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves the site over a real socket on an OS-assigned port', async () => {
    handle = await startStaticServer(config({ root: dir }))
    const response = await fetchRaw(handle.url)
    expect({ url: handle.url, status: response.status, body: response.body.toString() }).toEqual({
      url: `http://localhost:${handle.port}/`,
      status: 200,
      body: 'DISK',
    })
  })

  it('binds the configured host and reports it in the handle url', async () => {
    handle = await startStaticServer(config({ root: dir, host: '127.0.0.1' }))
    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}/`)
    await expect(fetchRaw(handle.url)).resolves.toEqual(expect.objectContaining({ status: 200 }))
  })

  it('reports localhost for a wildcard bind', async () => {
    handle = await startStaticServer(config({ root: dir, host: '0.0.0.0' }))
    expect(handle.url).toBe(`http://localhost:${handle.port}/`)
  })

  it('compresses a large asset end-to-end for a gzip client', async () => {
    handle = await startStaticServer(config({ root: dir }))
    const response = await fetchRaw(`${handle.url}big.js`, { 'accept-encoding': 'gzip' })
    expect({
      status: response.status,
      encoding: response.headers['content-encoding'],
      vary: response.headers['vary'],
      body: gunzipSync(response.body).toString(),
    }).toEqual({ status: 200, encoding: 'gzip', vary: 'Accept-Encoding', body: bigAsset })
  })

  it('uses an injected server factory', async () => {
    handle = await startStaticServer(config({ root: dir }), { createServer: (handler) => createServer(handler) })
    await expect(fetchRaw(handle.url)).resolves.toEqual(expect.objectContaining({ status: 200 }))
  })

  it('stops serving after close', async () => {
    handle = await startStaticServer(config({ root: dir }))
    const url = handle.url
    await handle.close()
    handle = undefined
    await expect(fetchRaw(url)).rejects.toThrow()
  })
})
