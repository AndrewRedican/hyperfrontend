import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeHeaderRule } from '../policy/serve-types'
import type { StaticRequest, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the file step builds, so the names below are keyed the way the step looks files up.
const ROOT = resolve('/site')

const at = (...segments: string[]): string => join(ROOT, ...segments)

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

// note: A zero width non-joiner, which stands for a character a volume leaves out when it compares names.
const IGNORED = '\u200c'

// note: Each spelling the volume answers to, beside the name it stores: the stored name itself, a short name in the shape Windows generates, and one written with a character the volume ignores.
const SPELLINGS: Readonly<Record<string, string>> = {
  [at('index.html')]: at('index.html'),
  [at('.env')]: at('.env'),
  [at('ENV~1')]: at('.env'),
  [at(`${IGNORED}.env`)]: at('.env'),
  [at('hf-serve.config.json')]: at('hf-serve.config.json'),
  [at('HF-SER~1.JSO')]: at('hf-serve.config.json'),
  [at('.git', 'config')]: at('.git', 'config'),
  [at('GIT~1', 'config')]: at('.git', 'config'),
  [at('.well', 'index.html')]: at('.well', 'index.html'),
  [at('WELL~1', 'index.html')]: at('.well', 'index.html'),
  [at('admin', 'panel.html')]: at('admin', 'panel.html'),
  [at('docs', 'index.html')]: at('docs', 'index.html'),
  [at('ADMIN~1', 'PANEL~1.HTM')]: at('admin', 'panel.html'),
  [at('ADMIN~1', 'panel.html')]: at('admin', 'panel.html'),
}

interface Volume {
  deps: ServeStepDeps
  lookups: string[]
  reads: string[]
}

// how: Serves each stored file under every spelling the table lists, and records each stored spelling asked for and each file read.
const aliasingVolume = (realPath?: (path: string) => string | null): Volume => {
  const lookups: string[] = []
  const reads: string[] = []
  return {
    lookups,
    reads,
    deps: {
      isFile: (path) => SPELLINGS[path] !== undefined,
      stat: (path) => (SPELLINGS[path] === undefined ? null : STATS),
      readFile: (path) => {
        reads.push(path)
        // why: The bytes are padded past the size a body is compressed from, so a request that accepts an encoding reaches the compression cache too.
        return Buffer.from(`BYTES OF ${SPELLINGS[path]}`.padEnd(2048))
      },
      realPath: (path) => {
        lookups.push(path)
        return realPath === undefined ? (path === ROOT ? ROOT : (SPELLINGS[path] ?? null)) : realPath(path)
      },
    },
  }
}

const get = (url: string, headers: StaticRequest['headers'] = {}): StaticRequest => ({ method: 'GET', url, headers })

const serve = (volume: Volume, request: StaticRequest, headers: readonly ServeHeaderRule[] = []): StaticResponse => {
  const config: ResolvedServeConfig = { root: ROOT, port: 4284, headers, log: false }
  return runSteps(buildServeSteps(config, volume.deps), request, { config })
}

describe('what is hidden, over a volume that answers to more than one spelling', () => {
  it.each([
    ['a dotfile by its short name', '/ENV~1'],
    ['a dotfile behind a character the volume ignores', `/${encodeURIComponent(`${IGNORED}.env`)}`],
    ['the config file by its short name', '/HF-SER~1.JSO'],
    ['a file below a dot directory reached by its short name', '/GIT~1/config'],
    ['the index of a dot directory reached by its short name', '/WELL~1/'],
  ])('answers 404 for %s', (_label: string, url: string) => {
    const response = serve(aliasingVolume(), get(url))
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('reads no byte of a hidden file reached by its short name', () => {
    const volume = aliasingVolume()
    serve(volume, get('/ENV~1'))
    expect(volume.reads).toEqual([])
  })

  it('answers 404 to a conditional request for a hidden file reached by its short name', () => {
    expect(serve(aliasingVolume(), get('/ENV~1', { 'if-none-match': '*' })).status).toBe(404)
  })

  it('answers 404 to a HEAD for a hidden file reached by its short name', () => {
    expect(serve(aliasingVolume(), { method: 'HEAD', url: '/HF-SER~1.JSO', headers: {} }).status).toBe(404)
  })

  it('withholds the redirect to a dot directory reached by its short name', () => {
    expect(serve(aliasingVolume(), get('/WELL~1')).status).toBe(404)
  })

  it('matches the 404 of a hidden file against the path as requested', () => {
    const rules: readonly ServeHeaderRule[] = [{ prefix: '/.', headers: { 'X-Area': 'hidden' } }]
    expect(serve(aliasingVolume(), get('/ENV~1'), rules).headers['X-Area']).toBeUndefined()
  })

  it('serves a file that is not hidden by its short name', () => {
    const response = serve(aliasingVolume(), get('/ADMIN~1/PANEL~1.HTM'))
    expect({ status: response.status, body: response.body?.toString().trimEnd() }).toEqual({
      status: 200,
      body: `BYTES OF ${at('admin', 'panel.html')}`,
    })
  })

  it('judges a path by its own spelling when the stored spelling of the file is unknown', () => {
    expect(
      serve(
        aliasingVolume((path) => (path === ROOT ? ROOT : null)),
        get('/ADMIN~1/PANEL~1.HTM')
      ).status
    ).toBe(200)
  })

  it('judges a path by its own spelling when the stored spelling of the root is unknown', () => {
    expect(
      serve(
        aliasingVolume(() => null),
        get('/index.html')
      ).status
    ).toBe(200)
  })

  it('judges a path by its own spelling when the stored file does not sit below the stored root', () => {
    const volume = aliasingVolume((path) => (path === ROOT ? ROOT : resolve('/elsewhere/.cache/index.html')))
    expect(serve(volume, get('/index.html')).status).toBe(200)
  })

  it('serves from a root that is stored below a dot directory', () => {
    const real = resolve('/srv/.releases/42')
    const volume = aliasingVolume((path) => (path === ROOT ? real : join(real, 'index.html')))
    expect(serve(volume, get('/index.html')).status).toBe(200)
  })

  it('asks for the stored spelling of the root and of the file once, whatever reads it', () => {
    const volume = aliasingVolume()
    // note: The file step, a bounded header rule and the compression cache each read where this page is stored.
    serve(volume, get('/ADMIN~1/panel.html', { 'accept-encoding': 'br' }), [{ prefix: '/admin/', headers: { 'X-Area': 'admin' } }])
    expect(volume.lookups).toEqual([ROOT, at('ADMIN~1', 'panel.html')])
  })

  it('asks for the stored spelling of a file the plan has no rule for', () => {
    const volume = aliasingVolume()
    serve(volume, get('/index.html'))
    expect(volume.lookups).toEqual([ROOT, at('index.html')])
  })

  it('redirects to a directory whose index is not hidden', () => {
    const response = serve(aliasingVolume(), get('/docs'))
    expect({ status: response.status, location: response.headers['Location'] }).toEqual({ status: 301, location: '/docs/' })
  })

  it('asks for no stored spelling of a path its own text already hides', () => {
    const volume = aliasingVolume()
    serve(volume, get('/.env'))
    expect(volume.lookups).toEqual([])
  })

  it('asks for the stored spelling of an index before redirecting to its directory', () => {
    const volume = aliasingVolume()
    serve(volume, get('/docs'))
    expect(volume.lookups).toEqual([ROOT, at('docs', 'index.html')])
  })
})
