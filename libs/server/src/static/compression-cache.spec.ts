import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { join, resolve } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
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

  it('asks where the file is stored once for each request, a cached one included', () => {
    const volume = foldingVolume()
    const get = pipeline(volume.deps)
    get('/assets/app.js')
    get('/ASSETS/app.js')
    get('/ASSETS/app.js')
    expect(volume.lookups).toEqual([ROOT, STORED, ROOT, join(ROOT, 'ASSETS', 'app.js'), ROOT, join(ROOT, 'ASSETS', 'app.js')])
  })
})

interface Releases {
  deps: ServeStepDeps
  point: (release: string) => void
}

// how: A served root that is a link to one of two releases, whose pages differ in their bytes and in nothing a file's stats report.
const linkedRoot = (): Releases => {
  let current = 'a'
  const page = join(ROOT, 'index.html')
  return {
    point: (release) => {
      current = release
    },
    deps: {
      isFile: (path) => path === page,
      stat: (path) => (path === page ? statsAt(4096) : null),
      readFile: () => Buffer.from(`<script src="/app.${current}.js"></script>`.padEnd(4096)),
      realPath: (path) => (path === ROOT ? resolve('/releases', current) : join(resolve('/releases', current), 'index.html')),
    },
  }
}

const decoded = (response: StaticResponse): string =>
  brotliDecompressSync(response.body as Buffer)
    .toString()
    .trimEnd()

describe('the compression cache below a root that is a link', () => {
  it('answers with the bytes of the release the link now leads to, although the entity tag did not change', () => {
    const releases = linkedRoot()
    const get = pipeline(releases.deps)
    const before = get('/index.html')
    releases.point('b')
    const after = get('/index.html')
    expect({ before: decoded(before), after: decoded(after), sameTag: before.headers['ETag'] === after.headers['ETag'] }).toEqual({
      before: '<script src="/app.a.js"></script>',
      after: '<script src="/app.b.js"></script>',
      sameTag: true,
    })
  })

  it('reuses the bytes while the link stays where it is', () => {
    const get = pipeline(linkedRoot().deps)
    const first = get('/index.html')
    expect(get('/index.html').body).toBe(first.body)
  })

  it('keeps one entry for a path, replaced when the link moves', () => {
    const releases = linkedRoot()
    const get = pipeline(releases.deps)
    const first = get('/index.html')
    releases.point('b')
    get('/index.html')
    releases.point('a')
    expect(get('/index.html').body).not.toBe(first.body)
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

describe('one compression step handed two roots', () => {
  // how: A terminal step that answers the same path, entity tag and size from whichever root the request's plan names.
  const terminal: ServeStep = (_request, context) => {
    context.filePath = join(context.config.root, 'index.html')
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: 'W/"1000-1000"' },
      body: Buffer.from(`PAGE OF ${context.config.root}`.padEnd(4096)),
    }
  }

  const roots = [resolve('/sites/one'), resolve('/sites/two')] as const

  const served = (steps: readonly ServeStep[], root: string): StaticResponse =>
    runSteps(steps, { method: 'GET', url: '/index.html', headers: { 'accept-encoding': 'br' } }, { config: { ...CONFIG, root } })

  it('answers each root with its own bytes', () => {
    const steps = [buildCompressionStep(), terminal]
    served(steps, roots[0])
    expect(decoded(served(steps, roots[1]))).toBe(`PAGE OF ${roots[1]}`)
  })

  it('keeps the bytes of one root while it answers the other', () => {
    const steps = [buildCompressionStep(), terminal]
    const first = served(steps, roots[0])
    served(steps, roots[1])
    expect(served(steps, roots[0]).body).toBe(first.body)
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
