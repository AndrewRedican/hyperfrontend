import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { buildCompressionStep } from './serve-compression'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'

// why: Resolve gives the fixture root the drive Windows prefixes onto every path the file step builds, so the stored names below are keyed the way the step looks files up.
const ROOT = resolve('/site')

const STORED = join(ROOT, 'assets', 'app.js')

const CONFIG: ResolvedServeConfig = { root: ROOT, port: 4284, headers: [], log: false }

const statsAt = (modified: number): FileStats => ({
  isFile: true,
  isDirectory: false,
  isSymlink: false,
  size: 4096,
  created: new Date(modified),
  modified: new Date(modified),
  accessed: new Date(modified),
  mode: 0o644,
})

interface Volume {
  deps: ServeStepDeps
  lookups: string[]
  touch: () => void
}

// how: A volume that ignores letter case holding one large script, which records each path whose stored spelling was asked for and can be told the file changed.
const foldingVolume = (): Volume => {
  const lookups: string[] = []
  let modified = 4096
  const holds = (path: string): boolean => path.toLowerCase() === STORED.toLowerCase()
  return {
    lookups,
    touch: () => {
      modified += 1000
    },
    deps: {
      isFile: holds,
      stat: (path) => (holds(path) ? statsAt(modified) : null),
      readFile: () => Buffer.from('x'.repeat(4096)),
      realPath: (path) => {
        lookups.push(path)
        return path === ROOT ? ROOT : holds(path) ? STORED : null
      },
    },
  }
}

// how: One pipeline per case, so its cache lives across the requests of that case.
const pipeline = (deps: ServeStepDeps): ((url: string, encoding?: string) => StaticResponse) => {
  const steps = buildServeSteps(CONFIG, deps)
  return (url, encoding = 'br') => runSteps(steps, { method: 'GET', url, headers: { 'accept-encoding': encoding } }, { config: CONFIG })
}

describe('the compression cache over a volume that folds spellings', () => {
  it('answers a respelled path with the bytes it compressed for the stored one', () => {
    const get = pipeline(foldingVolume().deps)
    const first = get('/assets/app.js')
    expect(get('/ASSETS/App.JS').body).toBe(first.body)
  })

  it('answers the stored path with the bytes it compressed for a respelled one', () => {
    const get = pipeline(foldingVolume().deps)
    const first = get('/Assets/APP.js')
    expect(get('/assets/app.js').body).toBe(first.body)
  })

  it('keeps the encodings of one file apart', () => {
    const get = pipeline(foldingVolume().deps)
    const brotli = get('/assets/app.js', 'br')
    expect(get('/ASSETS/app.js', 'gzip').headers['Content-Encoding']).not.toBe(brotli.headers['Content-Encoding'])
  })

  it('compresses again for a respelled path once the file has changed', () => {
    const volume = foldingVolume()
    const get = pipeline(volume.deps)
    const first = get('/assets/app.js')
    volume.touch()
    expect(get('/ASSETS/app.js').body).not.toBe(first.body)
  })

  it('answers the stored path with the bytes a respelled path replaced the stale ones with', () => {
    const volume = foldingVolume()
    const get = pipeline(volume.deps)
    get('/assets/app.js')
    volume.touch()
    const replaced = get('/ASSETS/app.js')
    expect(get('/assets/app.js').body).toBe(replaced.body)
  })

  it('asks for the stored spelling once for a path spelled as stored', () => {
    const volume = foldingVolume()
    const get = pipeline(volume.deps)
    get('/assets/app.js')
    get('/assets/app.js')
    expect(volume.lookups).toEqual([ROOT, STORED])
  })

  it('asks for the stored spelling of a respelled path on each request', () => {
    const volume = foldingVolume()
    const get = pipeline(volume.deps)
    get('/assets/app.js')
    get('/ASSETS/app.js')
    get('/ASSETS/app.js')
    expect(volume.lookups).toEqual([ROOT, STORED, ROOT, join(ROOT, 'ASSETS', 'app.js'), ROOT, join(ROOT, 'ASSETS', 'app.js')])
  })

  it('asks for no stored spelling when the client accepts no encoding', () => {
    const volume = foldingVolume()
    pipeline(volume.deps)('/assets/app.js', 'identity')
    expect(volume.lookups).toEqual([])
  })
})

describe('the compression cache over a site injected as values', () => {
  it('reuses the bytes of a path whose stored spelling the disk cannot tell', () => {
    const { isFile, stat, readFile } = foldingVolume().deps
    const get = pipeline({ isFile, stat, readFile })
    const first = get('/assets/app.js')
    expect(get('/assets/app.js').body).toBe(first.body)
  })
})

describe('buildCompressionStep', () => {
  it('caches under the path as resolved when the disk holds no such file', () => {
    const terminal: ServeStep = (_request, context) => {
      context.filePath = STORED
      return {
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8', ETag: 'W/"1000-1000"' },
        body: Buffer.from('x'.repeat(4096)),
      }
    }
    const steps = [buildCompressionStep(), terminal]
    const get = (): StaticResponse =>
      runSteps(steps, { method: 'GET', url: '/assets/app.js', headers: { 'accept-encoding': 'br' } }, { config: CONFIG })
    const first = get()
    expect(get().body).toBe(first.body)
  })
})
