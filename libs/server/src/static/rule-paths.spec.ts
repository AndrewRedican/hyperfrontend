import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeHeaderRule } from '../policy/serve-types'
import type { ServeStep, StaticRequest, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the file step builds, so the stored names below are keyed the way the step looks files up.
const ROOT = resolve('/site')

const at = (...segments: string[]): string => join(ROOT, ...segments)

// note: One directory name in its two canonically equal spellings: composed, as stored, and decomposed, as a request may write it.
const CAFE = 'caf\u00e9'

const CAFE_DECOMPOSED = 'cafe\u0301'

const STATS: FileStats = {
  isFile: true,
  isDirectory: false,
  isSymlink: false,
  size: 4,
  created: new Date(4096),
  modified: new Date(4096),
  accessed: new Date(4096),
  mode: 0o644,
}

// note: The names the volume stores, each in the one spelling its directory lists.
const STORED: readonly string[] = [at('index.html'), at('host', 'index.html'), at('host', 'app.js'), at(CAFE, 'menu.html')]

// how: A volume that ignores letter case and Unicode normalisation finds a stored name under any spelling that folds to it.
const fold = (path: string): string => path.normalize('NFC').toLowerCase()

const stored = (path: string): string | undefined => STORED.find((name) => fold(name) === fold(path))

interface Volume {
  deps: ServeStepDeps
  lookups: string[]
}

// how: Serves the stored names under any spelling, and records each path whose stored spelling was asked for.
const foldingVolume = (realPath?: (path: string) => string | null): Volume => {
  const lookups: string[] = []
  return {
    lookups,
    deps: {
      isFile: (path) => stored(path) !== undefined,
      stat: (path) => (stored(path) === undefined ? null : STATS),
      readFile: () => Buffer.from('body'),
      realPath: (path) => {
        lookups.push(path)
        return realPath === undefined ? (path === ROOT ? ROOT : (stored(path) ?? null)) : realPath(path)
      },
    },
  }
}

const HOST_RULE: ServeHeaderRule = { prefix: '/host/', headers: { 'X-Area': 'host' } }

const PAGE_RULE: ServeHeaderRule = { suffix: '.html', headers: { 'X-Kind': 'page' } }

const SITE_RULE: ServeHeaderRule = { headers: { 'X-Area': 'site' } }

const plan = (headers: readonly ServeHeaderRule[]): ResolvedServeConfig => ({ root: ROOT, port: 4284, headers, log: false })

const get = (url: string, headers: StaticRequest['headers'] = {}): StaticRequest => ({ method: 'GET', url, headers })

const serve = (headers: readonly ServeHeaderRule[], volume: Volume, request: StaticRequest): StaticResponse => {
  const config = plan(headers)
  return runSteps(buildServeSteps(config, volume.deps), request, { config })
}

describe('header rules over a volume that folds spellings', () => {
  it('sends a respelled path the rule of the directory the file is stored in', () => {
    expect(serve([SITE_RULE, HOST_RULE], foldingVolume(), get('/HOST/index.html')).headers['X-Area']).toBe('host')
  })

  it('sends a respelled directory url the rule of the index it serves', () => {
    expect(serve([SITE_RULE, HOST_RULE], foldingVolume(), get('/Host/')).headers['X-Area']).toBe('host')
  })

  it('matches a suffix against the stored file name', () => {
    expect(serve([PAGE_RULE], foldingVolume(), get('/host/INDEX.HTML')).headers['X-Kind']).toBe('page')
  })

  it('withholds a suffix rule from a file whose stored name does not end with it', () => {
    expect(
      serve([{ suffix: '.JS', headers: { 'X-Kind': 'script' } }], foldingVolume(), get('/host/APP.JS')).headers['X-Kind']
    ).toBeUndefined()
  })

  it('sends a conditional answer the rule of the stored path', () => {
    const response = serve([SITE_RULE, HOST_RULE], foldingVolume(), get('/HOST/app.js', { 'if-none-match': '*' }))
    expect({ status: response.status, area: response.headers['X-Area'] }).toEqual({ status: 304, area: 'host' })
  })

  it('matches a rule written in the stored normalisation when the request used another', () => {
    const rule: ServeHeaderRule = { prefix: `/${CAFE}/`, headers: { 'X-Area': 'cafe' } }
    expect(serve([rule], foldingVolume(), get(`/${encodeURIComponent(CAFE_DECOMPOSED)}/menu.html`)).headers['X-Area']).toBe('cafe')
  })

  it('keeps serving a respelled path instead of answering 404', () => {
    expect(serve([HOST_RULE], foldingVolume(), get('/HOST/APP.JS')).status).toBe(200)
  })

  it('asks for the stored spelling of the root and then of the file', () => {
    const volume = foldingVolume()
    serve([HOST_RULE], volume, get('/HOST/index.html'))
    expect(volume.lookups).toEqual([ROOT, at('HOST', 'index.html')])
  })

  it('asks for the stored spelling once when a bounded rule reads what the file step was told', () => {
    const volume = foldingVolume()
    serve([HOST_RULE, PAGE_RULE], volume, get('/HOST/index.html'))
    expect(volume.lookups).toEqual([ROOT, at('HOST', 'index.html')])
  })

  it('sends a file reached by a request target with no leading slash the rule written for every path below the root', () => {
    expect(serve([{ prefix: '/', headers: { 'X-Area': 'site' } }], foldingVolume(), get('index.html')).headers['X-Area']).toBe('site')
  })

  it('asks for no stored spelling of a path that answers 404', () => {
    const volume = foldingVolume()
    serve([HOST_RULE], volume, get('/host/missing.html'))
    expect(volume.lookups).toEqual([])
  })

  it('asks for the stored spelling of the index of a directory it redirects to, and of nothing for the rules', () => {
    const volume = foldingVolume()
    serve([HOST_RULE], volume, get('/host'))
    expect(volume.lookups).toEqual([ROOT, at('host', 'index.html')])
  })

  it('matches a redirect against the path as requested', () => {
    const response = serve([{ prefix: '/host', headers: { 'X-Area': 'host' } }], foldingVolume(), get('/HOST'))
    expect({ status: response.status, location: response.headers['Location'], area: response.headers['X-Area'] }).toEqual({
      status: 301,
      location: '/HOST/',
      area: undefined,
    })
  })

  it('falls back to the resolved path when the stored spelling of the file is unknown', () => {
    const volume = foldingVolume((path) => (path === ROOT ? ROOT : null))
    expect(serve([SITE_RULE, HOST_RULE], volume, get('/HOST/index.html')).headers['X-Area']).toBe('site')
  })

  it('falls back to the resolved path without asking about the file when the stored root is unknown', () => {
    const volume = foldingVolume(() => null)
    serve([SITE_RULE, HOST_RULE], volume, get('/host/index.html'))
    expect(volume.lookups).toEqual([ROOT])
  })

  it('falls back to the resolved path when the stored file sits outside the stored root', () => {
    const volume = foldingVolume((path) => (path === ROOT ? ROOT : resolve('/elsewhere/host/index.html')))
    expect(
      serve([SITE_RULE, { prefix: '/HOST/', headers: { 'X-Area': 'as-resolved' } }], volume, get('/HOST/index.html')).headers['X-Area']
    ).toBe('as-resolved')
  })

  it('reads the path below a served root that is a link from where the link leads', () => {
    const real = resolve('/releases/42')
    const volume = foldingVolume((path) => (path === ROOT ? real : join(real, 'host', 'index.html')))
    expect(serve([SITE_RULE, HOST_RULE], volume, get('/HOST/index.html')).headers['X-Area']).toBe('host')
  })

  it('does not take a sibling whose name starts like the stored root for a path below it', () => {
    const volume = foldingVolume((path) => (path === ROOT ? ROOT : `${ROOT}-old${join('/', 'host', 'index.html')}`))
    expect(serve([SITE_RULE, HOST_RULE], volume, get('/index.html')).headers['X-Area']).toBe('site')
  })
})

describe('the header rules step above a file step of the caller', () => {
  // how: Stands in for a file step the caller wrote, which records the file it resolved and asks nothing of the volume.
  const terminal: ServeStep = (_request, context) => {
    context.filePath = at('HOST', 'index.html')
    return { status: 200, headers: {}, body: null }
  }

  // note: The header rules step is the third of the built-ins, inside the method guard and compression.
  const above = (headers: readonly ServeHeaderRule[], volume: Volume): StaticResponse => {
    const config = plan(headers)
    return runSteps([buildServeSteps(config, volume.deps)[2] as ServeStep, terminal], get('/HOST/index.html'), { config })
  }

  it('looks up where the file is stored for a bounded rule', () => {
    expect(above([SITE_RULE, HOST_RULE], foldingVolume()).headers['X-Area']).toBe('host')
  })

  it('asks for the stored spelling of the root and then of the file', () => {
    const volume = foldingVolume()
    above([HOST_RULE], volume)
    expect(volume.lookups).toEqual([ROOT, at('HOST', 'index.html')])
  })

  it('asks for no stored spelling when the plan has no rule', () => {
    const volume = foldingVolume()
    above([], volume)
    expect(volume.lookups).toEqual([])
  })
})

describe('header rules over a site injected as values', () => {
  // how: Only the three boundaries a caller has always injected are given, so the stored spelling is asked of a disk that holds none of these paths.
  const values: ServeStepDeps = {
    isFile: (path) => stored(path) !== undefined,
    stat: (path) => (stored(path) === undefined ? null : STATS),
    readFile: () => Buffer.from('body'),
  }

  it('matches a bounded rule against the path as resolved', () => {
    const config = plan([SITE_RULE, HOST_RULE])
    expect(runSteps(buildServeSteps(config, values), get('/host/index.html'), { config }).headers['X-Area']).toBe('host')
  })

  it('leaves a respelled path with the rules its spelling matches', () => {
    const config = plan([SITE_RULE, HOST_RULE])
    expect(runSteps(buildServeSteps(config, values), get('/HOST/index.html'), { config }).headers['X-Area']).toBe('site')
  })
})
