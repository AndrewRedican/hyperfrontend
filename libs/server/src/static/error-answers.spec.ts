import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeHeaderRule } from '../policy/serve-types'
import type { StaticRequest, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { immutableAssets } from '../policy/presets'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the file step builds.
const ROOT = resolve('/site')

// note: A year, the lifetime an asset rule writes for a file whose name carries a hash of its bytes.
const YEAR = 'max-age=31536000'

const PLAIN = 'text/plain; charset=utf-8'

const stats = (size: number, isFile: boolean): FileStats => ({
  isFile,
  isDirectory: !isFile,
  isSymlink: false,
  size,
  created: new Date(4096),
  modified: new Date(4096),
  accessed: new Date(4096),
  mode: 0o644,
})

const FILES: Record<string, string> = {
  [join(ROOT, 'assets', 'app.js')]: 'app',
  [join(ROOT, 'docs', 'index.html')]: '<html>docs</html>',
  [join(ROOT, 'assets', '.env')]: 'SECRET',
}

// note: An in-memory site; the stored path of a file is the path it was asked under.
const deps: ServeStepDeps = {
  readFile: (filePath) => Buffer.from(FILES[filePath] as string),
  isFile: (filePath) => FILES[filePath] !== undefined,
  stat: (filePath) => (FILES[filePath] === undefined ? null : stats((FILES[filePath] as string).length, true)),
  realPath: (path) => path,
}

// note: One rule for every path, carrying a lifetime for a browser, a lifetime for a delivery network and a framing policy.
const EVERYWHERE: ServeHeaderRule = {
  headers: { 'Cache-Control': `public, ${YEAR}, immutable`, 'CDN-Cache-Control': YEAR, 'X-Frame-Options': 'DENY' },
}

const answer = (rules: readonly ServeHeaderRule[], url: string, method = 'GET', headers: StaticRequest['headers'] = {}): StaticResponse => {
  const config: ResolvedServeConfig = { root: ROOT, port: 4284, headers: rules, log: false }
  return runSteps(buildServeSteps(config, deps), { method, url, headers }, { config })
}

// note: One answer of each error status the built-in steps give, all under the asset prefix.
const ERRORS: readonly [name: string, url: string, method: string, status: number][] = [
  ['404 for a file that is not there', '/assets/missing.js', 'GET', 404],
  ['404 for a hidden file', '/assets/.env', 'GET', 404],
  ['403 for a path above the root', '/assets/../../x', 'GET', 403],
  ['400 for a malformed path', '/assets/%', 'GET', 400],
  ['405 for a write method', '/assets/app.js', 'POST', 405],
]

// note: The headers each error carries before any rule is folded over it.
const own = (status: number): Record<string, string> =>
  status === 405 ? { 'Content-Type': PLAIN, Allow: 'GET, HEAD' } : { 'Content-Type': PLAIN }

describe('an error the built-in steps answer', () => {
  it.each(ERRORS)('takes the framing policy and no-store in place of the lifetime: %s', (_name, url, method, status) => {
    const response = answer([EVERYWHERE], url, method)
    expect({ status: response.status, headers: response.headers }).toEqual({
      status,
      headers: { ...own(status), 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' },
    })
  })

  it.each(ERRORS)('stays out of every cache under a rule that forbids storing: %s', (_name, url, method, status) => {
    const response = answer([{ headers: { 'Cache-Control': 'no-store' } }], url, method)
    expect({ status: response.status, headers: response.headers }).toEqual({
      status,
      headers: { ...own(status), 'Cache-Control': 'no-store' },
    })
  })

  it.each(ERRORS)('stays out of every cache under a rule that keeps answers private: %s', (_name, url, method, status) => {
    const response = answer([{ headers: { 'Cache-Control': 'private, no-cache' } }], url, method)
    expect({ status: response.status, headers: response.headers }).toEqual({
      status,
      headers: { ...own(status), 'Cache-Control': 'no-store' },
    })
  })

  it.each(ERRORS)('carries no cache header under a plan with no cache rule: %s', (_name, url, method, status) => {
    const response = answer([{ headers: { 'X-Frame-Options': 'DENY' } }], url, method)
    expect({ status: response.status, headers: response.headers }).toEqual({
      status,
      headers: { ...own(status), 'X-Frame-Options': 'DENY' },
    })
  })

  it.each([['Expires'], ['Surrogate-Control'], ['X-Accel-Expires'], ['Cloudflare-CDN-Cache-Control'], ['cache-control']])(
    'answers no-store in place of the %s of a matching rule',
    (name: string) => {
      expect(answer([{ headers: { [name]: YEAR } }], '/assets/missing.js').headers).toEqual({
        'Content-Type': PLAIN,
        'Cache-Control': 'no-store',
      })
    }
  )

  it('carries no cache header when the rule that names one does not match the path', () => {
    expect(answer([immutableAssets('/assets/')], '/missing.html').headers).toEqual({ 'Content-Type': PLAIN })
  })

  it('answers no-store in place of the lifetime of the preset written for hashed assets', () => {
    expect(answer([immutableAssets('/assets/')], '/assets/index-00000000.js').headers).toEqual({
      'Content-Type': PLAIN,
      'Cache-Control': 'no-store',
    })
  })
})

describe('an answer below 400 under the same rule', () => {
  it('keeps every rule header on a 200', () => {
    const response = answer([EVERYWHERE], '/assets/app.js')
    expect({ status: response.status, headers: response.headers }).toEqual({
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': '3',
        ETag: 'W/"3-1000"',
        'Cache-Control': `public, ${YEAR}, immutable`,
        'CDN-Cache-Control': YEAR,
        'X-Frame-Options': 'DENY',
        Vary: 'Accept-Encoding',
      },
    })
  })

  it('keeps every rule header on a 304', () => {
    const response = answer([EVERYWHERE], '/assets/app.js', 'GET', { 'if-none-match': 'W/"3-1000"' })
    expect({ status: response.status, headers: response.headers }).toEqual({
      status: 304,
      headers: {
        ETag: 'W/"3-1000"',
        'Cache-Control': `public, ${YEAR}, immutable`,
        'CDN-Cache-Control': YEAR,
        'X-Frame-Options': 'DENY',
        Vary: 'Accept-Encoding',
      },
    })
  })

  it('keeps every rule header on a 301', () => {
    const response = answer([EVERYWHERE], '/docs')
    expect({ status: response.status, headers: response.headers }).toEqual({
      status: 301,
      headers: { Location: '/docs/', 'Cache-Control': `public, ${YEAR}, immutable`, 'CDN-Cache-Control': YEAR, 'X-Frame-Options': 'DENY' },
    })
  })
})
