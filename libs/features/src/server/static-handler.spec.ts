import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticHandler, requestPath, serveFile } from './static-handler'

interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  res: ServerResponse
}

const fakeRes = (): FakeResponse => {
  const state: FakeResponse = { statusCode: 0, headers: {}, body: '', res: <ServerResponse>{} }
  state.res = <ServerResponse>(<unknown>{
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
  })
  return state
}

const deps = (exists: (path: string) => boolean) => ({ isFile: exists, readFile: (path: string) => Buffer.from(`bytes:${path}`) })

// note: Stands in for a directory on disk — the directory path itself is not a file, the index inside it is.
const hasIndexOnly = (path: string) => path.endsWith('index.html')

describe('serveFile', () => {
  it('serves the index for the root path', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/',
      out.res,
      deps(() => true)
    )
    expect({ status: out.statusCode, type: out.headers['Content-Type'], body: out.body }).toEqual({
      status: 200,
      type: 'text/html; charset=utf-8',
      body: 'bytes:/srv/index.html',
    })
  })

  it('maps a known extension to its content type', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/app.js',
      out.res,
      deps(() => true)
    )
    expect(out.headers['Content-Type']).toBe('text/javascript; charset=utf-8')
  })

  it('falls back to octet-stream for an unknown extension', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/data.xyz',
      out.res,
      deps(() => true)
    )
    expect(out.headers['Content-Type']).toBe('application/octet-stream')
  })

  it('strips the query string before resolving', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/app.js?v=2',
      out.res,
      deps(() => true)
    )
    expect(out.body).toBe('bytes:/srv/app.js')
  })

  it('allows a path that resolves to the root itself', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '//',
      out.res,
      deps(() => true)
    )
    expect(out.statusCode).toBe(200)
  })

  it('returns 404 when the file is missing', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/missing.js',
      out.res,
      deps(() => false)
    )
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('serves the directory index for a nested directory url', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/host/',
      out.res,
      deps(() => true)
    )
    expect({ status: out.statusCode, type: out.headers['Content-Type'], body: out.body }).toEqual({
      status: 200,
      type: 'text/html; charset=utf-8',
      body: 'bytes:/srv/host/index.html',
    })
  })

  it('redirects an unslashed directory url to its slashed form', () => {
    const out = fakeRes()
    serveFile('/srv', '/host', out.res, deps(hasIndexOnly))
    expect({ status: out.statusCode, location: out.headers['Location'], body: out.body }).toEqual({
      status: 301,
      location: '/host/',
      body: '',
    })
  })

  it('keeps the query string on the directory redirect', () => {
    const out = fakeRes()
    serveFile('/srv', '/host?debug=1', out.res, deps(hasIndexOnly))
    expect(out.headers['Location']).toBe('/host/?debug=1')
  })

  it('returns 404 for a directory url with no index', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/host/',
      out.res,
      deps(() => false)
    )
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('returns 404 rather than redirecting when the directory has no index', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/host',
      out.res,
      deps(() => false)
    )
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('returns 403 on a traversal attempt', () => {
    const out = fakeRes()
    serveFile(
      '/srv',
      '/../secret',
      out.res,
      deps(() => true)
    )
    expect({ status: out.statusCode, body: out.body }).toEqual({ status: 403, body: 'Forbidden' })
  })
})

describe('requestPath', () => {
  it('defaults a missing url to the root', () => {
    expect(requestPath(undefined)).toBe('/')
  })

  it('returns a query-less path unchanged', () => {
    expect(requestPath('/app.js')).toBe('/app.js')
  })

  it('drops the query string', () => {
    expect(requestPath('/app.js?v=2')).toBe('/app.js')
  })
})

describe('createStaticHandler', () => {
  it('serves the requested url', () => {
    const out = fakeRes()
    createStaticHandler(
      '/srv',
      deps(() => true)
    )(<IncomingMessage>{ url: '/app.js' }, out.res)
    expect(out.body).toBe('bytes:/srv/app.js')
  })

  it('defaults a missing url to the index', () => {
    const out = fakeRes()
    createStaticHandler(
      '/srv',
      deps(() => true)
    )(<IncomingMessage>{}, out.res)
    expect(out.body).toBe('bytes:/srv/index.html')
  })
})

describe('default file system', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-static-'))
    writeFileSync(join(dir, 'index.html'), 'DISK')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves a file from disk when no overrides are given', () => {
    const out = fakeRes()
    serveFile(dir, '/', out.res)
    expect(out.body).toBe('DISK')
  })

  it('serves a nested directory index from disk when no overrides are given', () => {
    mkdirSync(join(dir, 'host'))
    writeFileSync(join(dir, 'host', 'index.html'), 'HOST')
    const out = fakeRes()
    createStaticHandler(dir)(<IncomingMessage>{ url: '/host/' }, out.res)
    expect(out.body).toBe('HOST')
  })

  it('redirects an unslashed directory from disk when no overrides are given', () => {
    mkdirSync(join(dir, 'host'))
    writeFileSync(join(dir, 'host', 'index.html'), 'HOST')
    const out = fakeRes()
    createStaticHandler(dir)(<IncomingMessage>{ url: '/host' }, out.res)
    expect({ status: out.statusCode, location: out.headers['Location'] }).toEqual({ status: 301, location: '/host/' })
  })

  it('reports a missing file from disk when no overrides are given', () => {
    const out = fakeRes()
    createStaticHandler(dir)(<IncomingMessage>{ url: '/missing.js' }, out.res)
    expect(out.statusCode).toBe(404)
  })
})
