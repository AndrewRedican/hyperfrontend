import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStepDeps } from './serve-steps'
import type { StaticHandlerDeps } from './static-handler'
import { existsSync, symlinkSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir, useTempDir } from '@hyperfrontend/testing/fs'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'
import { createStaticHandler, serveFile } from './static-handler'

interface Answer {
  status: number
  location: string | undefined
  body: string
}

type Serve = (root: string, url: string) => Answer

// how: Runs one GET through the built-in pipeline; with no deps, every file-system boundary is the production default.
const pipelineAnswer = (root: string, url: string, deps?: ServeStepDeps): Answer => {
  const config: ResolvedServeConfig = { root, port: 4284, headers: [], log: false }
  const response = runSteps(buildServeSteps(config, deps), { method: 'GET', url, headers: {} }, { config })
  return { status: response.status, location: response.headers['Location'], body: response.body?.toString() ?? '' }
}

// how: Hands a recording response to whatever writes it, and reports what was written.
const written = (write: (res: ServerResponse) => void): Answer => {
  const headers: Record<string, string> = {}
  const answer = { status: 0, body: '' }
  write({
    set statusCode(value: number) {
      answer.status = value
    },
    setHeader: (name: string, value: string) => {
      headers[name] = value
    },
    end: (chunk?: Buffer | string) => {
      answer.body = chunk === undefined ? '' : chunk.toString()
    },
  } as unknown as ServerResponse)
  return { ...answer, location: headers['Location'] }
}

const throughPipeline: Serve = (root, url) => pipelineAnswer(root, url)

// how: Runs one request through the single-root handler with every file-system boundary left at its production default.
const throughHandler: Serve = (root, url) => written((res) => createStaticHandler(root)({ url } as IncomingMessage, res))

// why: A junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere.
const linkDirectory = (target: string, link: string): void => symlinkSync(target, link, 'junction')

// why: Windows creates a file symlink only for an elevated or developer-mode account, so the cases that need one are skipped where the platform refuses.
const fileLinksAllowed = ((): boolean => {
  const probe = createTempDir({ prefix: 'hf-link-probe-' })
  try {
    symlinkSync(probe.write('target.txt', 'target'), probe.resolve('link.txt'), 'file')
    return true
  } catch {
    return false
  } finally {
    probe.remove()
  }
})()

const itWithFileLinks = fileLinksAllowed ? it : it.skip

const NOT_FOUND: Answer = { status: 404, location: undefined, body: 'Not Found' }

describe.each([
  ['the step pipeline', throughPipeline],
  ['the single-root handler', throughHandler],
] satisfies [string, Serve][])('symlinks under %s', (_path: string, serve: Serve) => {
  const tmp = useTempDir({ prefix: 'hf-serve-links-' })

  // how: Every case reads the same layout, a site beside a directory it must never serve, joined by links of each shape.
  const site = (...segments: string[]): string => tmp.resolve('site', ...segments)
  const outside = (...segments: string[]): string => tmp.resolve('outside', ...segments)

  beforeEach(() => {
    tmp.writeTree({
      'site/index.html': 'HOME',
      'site/sub/index.html': 'SUB',
      'site/sub/notes.txt': 'notes',
      'site/deep/er/page.txt': 'page',
      'site/framed/app.js': 'app',
      'outside/secret.txt': 'secret',
      'outside/index.html': 'OUTSIDE',
      'outside/nested/file.txt': 'nested',
    })
    linkDirectory(outside(), site('linkdir'))
    linkDirectory(outside(), site('deep', 'er', 'linkdir'))
    linkDirectory(site('sub'), site('alias'))
    linkDirectory(outside('nested'), outside('inner'))
    linkDirectory(site(), tmp.resolve('current'))
    if (fileLinksAllowed) {
      symlinkSync(outside('secret.txt'), site('leak.txt'), 'file')
      symlinkSync(site('sub', 'notes.txt'), site('copy.txt'), 'file')
      symlinkSync(site('sub', 'index.html'), site('framed', 'index.html'), 'file')
    }
  })

  it('serves a file reached through no link', () => {
    expect(serve(site(), '/deep/er/page.txt')).toEqual({ status: 200, location: undefined, body: 'page' })
  })

  it('answers a differently cased spelling exactly as the volume resolves it', () => {
    // why: A case-insensitive volume reaches the file under a spelling its real path does not carry; with no link in the way that is a hit, never a 404.
    expect(serve(site(), '/SUB/NOTES.TXT').status).toBe(existsSync(site('SUB', 'NOTES.TXT')) ? 200 : 404)
  })

  it('answers 404 for a file below a symlinked directory', () => {
    expect(serve(site(), '/linkdir/secret.txt')).toEqual(NOT_FOUND)
  })

  it('answers 404 instead of redirecting an unslashed symlinked directory', () => {
    expect(serve(site(), '/linkdir')).toEqual(NOT_FOUND)
  })

  it('answers 404 for the index of a slashed symlinked directory', () => {
    expect(serve(site(), '/linkdir/')).toEqual(NOT_FOUND)
  })

  it('answers 404 for a file in a real directory below a symlinked one', () => {
    expect(serve(site(), '/linkdir/nested/file.txt')).toEqual(NOT_FOUND)
  })

  it('answers 404 for a file reached through a link inside a symlinked directory', () => {
    expect(serve(site(), '/linkdir/inner/file.txt')).toEqual(NOT_FOUND)
  })

  it('answers 404 for a symlinked directory nested below real directories', () => {
    expect(serve(site(), '/deep/er/linkdir/secret.txt')).toEqual(NOT_FOUND)
  })

  it('answers 404 for a file below a directory link that points inside the root', () => {
    expect(serve(site(), '/alias/notes.txt')).toEqual(NOT_FOUND)
  })

  it('answers 404 instead of redirecting a directory link that points inside the root', () => {
    expect(serve(site(), '/alias')).toEqual(NOT_FOUND)
  })

  itWithFileLinks('answers 404 for a symlinked file', () => {
    expect(serve(site(), '/leak.txt')).toEqual(NOT_FOUND)
  })

  itWithFileLinks('answers 404 for a file link that points inside the root', () => {
    expect(serve(site(), '/copy.txt')).toEqual(NOT_FOUND)
  })

  itWithFileLinks('answers 404 instead of redirecting to a symlinked index', () => {
    expect(serve(site(), '/framed')).toEqual(NOT_FOUND)
  })

  itWithFileLinks('answers 404 for a slashed directory whose index is a symlink', () => {
    expect(serve(site(), '/framed/')).toEqual(NOT_FOUND)
  })

  itWithFileLinks('serves a regular file beside a symlinked index', () => {
    expect(serve(site(), '/framed/app.js')).toEqual({ status: 200, location: undefined, body: 'app' })
  })

  it('serves a file from a root that is itself a symlink', () => {
    expect(serve(tmp.resolve('current'), '/sub/notes.txt')).toEqual({ status: 200, location: undefined, body: 'notes' })
  })

  it('serves the index from a root that is itself a symlink', () => {
    expect(serve(tmp.resolve('current'), '/')).toEqual({ status: 200, location: undefined, body: 'HOME' })
  })

  it('redirects an unslashed directory under a root that is itself a symlink', () => {
    expect(serve(tmp.resolve('current'), '/sub')).toEqual({ status: 301, location: '/sub/', body: '' })
  })

  it('answers 404 for a symlinked directory under a root that is itself a symlink', () => {
    expect(serve(tmp.resolve('current'), '/linkdir/secret.txt')).toEqual(NOT_FOUND)
  })

  it('serves a file from a symlinked root spelled with a trailing separator', () => {
    expect(serve(join(tmp.resolve('current'), '/'), '/sub/notes.txt')).toEqual({ status: 200, location: undefined, body: 'notes' })
  })
})

// why: Resolve gives the in-memory root the drive Windows prefixes onto every path the serving code builds.
const ROOT = resolve('/site')

// how: Both serving paths look files up by native path, so every in-memory path is joined the way they join it.
const at = (...segments: string[]): string => join(ROOT, ...segments)

const statsOf = (kind: 'file' | 'directory' | 'link'): FileStats => ({
  isFile: kind === 'file',
  isDirectory: kind === 'directory',
  isSymlink: kind === 'link',
  size: 5,
  created: new Date(4096),
  modified: new Date(4096),
  accessed: new Date(4096),
  mode: 0o644,
})

interface MemorySite<TDeps> {
  deps: TDeps
  asked: string[]
}

// how: A site held in memory for the pipeline: the listed files exist, the listed paths report as links, and every stats lookup is recorded in order.
const statSite = (files: readonly string[], links: readonly string[] = []): MemorySite<ServeStepDeps> => {
  const asked: string[] = []
  return {
    asked,
    deps: {
      readFile: () => Buffer.from('bytes'),
      isFile: (filePath) => files.includes(filePath),
      stat: (filePath) => {
        asked.push(filePath)
        if (links.includes(filePath)) {
          return statsOf('link')
        }
        return files.includes(filePath) ? statsOf('file') : null
      },
    },
  }
}

// how: The same site for the single-root handler, whose link test is a boundary of its own; every link lookup is recorded in order.
const linkSite = (files: readonly string[], links: readonly string[] = []): MemorySite<StaticHandlerDeps> => {
  const asked: string[] = []
  return {
    asked,
    deps: {
      readFile: () => Buffer.from('bytes'),
      isFile: (filePath) => files.includes(filePath),
      isSymlink: (path) => {
        asked.push(path)
        return links.includes(path)
      },
    },
  }
}

describe('file step over an injected stats boundary', () => {
  it('serves a file when no stats report a link', () => {
    expect(pipelineAnswer(ROOT, '/sub/notes.txt', statSite([at('sub', 'notes.txt')]).deps)).toEqual({
      status: 200,
      location: undefined,
      body: 'bytes',
    })
  })

  it('serves a file whose directory reports as a directory', () => {
    const site = statSite([at('sub', 'notes.txt')])
    const deps: ServeStepDeps = { ...site.deps, stat: (filePath) => statsOf(filePath === at('sub') ? 'directory' : 'file') }
    expect(pipelineAnswer(ROOT, '/sub/notes.txt', deps).status).toBe(200)
  })

  it('answers 404 when the directory holding the file reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/sub/notes.txt', statSite([at('sub', 'notes.txt')], [at('sub')]).deps)).toEqual(NOT_FOUND)
  })

  it('answers 404 when a directory further above the file reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/a/b/c.txt', statSite([at('a', 'b', 'c.txt')], [at('a')]).deps)).toEqual(NOT_FOUND)
  })

  it('answers 404 when the file itself reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/notes.txt', statSite([at('notes.txt')], [at('notes.txt')]).deps)).toEqual(NOT_FOUND)
  })

  it('withholds the redirect when the directory reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/sub', statSite([at('sub', 'index.html')], [at('sub')]).deps)).toEqual(NOT_FOUND)
  })

  it('withholds the redirect when the index reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/sub', statSite([at('sub', 'index.html')], [at('sub', 'index.html')]).deps)).toEqual(NOT_FOUND)
  })

  it('withholds the redirect when a directory above the directory reports as a link', () => {
    expect(pipelineAnswer(ROOT, '/a/b', statSite([at('a', 'b', 'index.html')], [at('a')]).deps)).toEqual(NOT_FOUND)
  })

  it('reads the stats of the file, then of each directory below the root, and never of the root', () => {
    const site = statSite([at('a', 'b', 'c.txt')])
    pipelineAnswer(ROOT, '/a/b/c.txt', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'c.txt'), at('a', 'b'), at('a')])
  })

  it('reads no directory stats for a file at the top of the root', () => {
    const site = statSite([at('index.html')])
    pipelineAnswer(ROOT, '/', site.deps)
    expect(site.asked).toEqual([at('index.html')])
  })

  it('reads no directory stats for a missing file', () => {
    const site = statSite([])
    pipelineAnswer(ROOT, '/a/b/missing.txt', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'missing.txt')])
  })

  it('stops reading stats at the first link above the file', () => {
    const site = statSite([at('a', 'b', 'c.txt')], [at('a', 'b')])
    pipelineAnswer(ROOT, '/a/b/c.txt', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'c.txt'), at('a', 'b')])
  })

  it('reads the stats of the index and of each directory below the root before redirecting', () => {
    const site = statSite([at('a', 'b', 'index.html')])
    pipelineAnswer(ROOT, '/a/b', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'index.html'), at('a', 'b'), at('a')])
  })

  it('never reads the stats of a root spelled with a trailing separator', () => {
    const site = statSite([at('sub', 'notes.txt')])
    pipelineAnswer(`${ROOT}${sep}`, '/sub/notes.txt', site.deps)
    expect(site.asked).toEqual([at('sub', 'notes.txt'), at('sub')])
  })
})

describe('single-root handler over an injected link test', () => {
  const handled = (url: string, deps: StaticHandlerDeps, root = ROOT): Answer => written((res) => serveFile(root, url, res, deps))

  it('serves a file when nothing reports as a link', () => {
    expect(handled('/sub/notes.txt', linkSite([at('sub', 'notes.txt')]).deps)).toEqual({ status: 200, location: undefined, body: 'bytes' })
  })

  it('answers 404 when the directory holding the file reports as a link', () => {
    expect(handled('/sub/notes.txt', linkSite([at('sub', 'notes.txt')], [at('sub')]).deps)).toEqual(NOT_FOUND)
  })

  it('answers 404 when a directory further above the file reports as a link', () => {
    expect(handled('/a/b/c.txt', linkSite([at('a', 'b', 'c.txt')], [at('a')]).deps)).toEqual(NOT_FOUND)
  })

  it('answers 404 when the file itself reports as a link', () => {
    expect(handled('/notes.txt', linkSite([at('notes.txt')], [at('notes.txt')]).deps)).toEqual(NOT_FOUND)
  })

  it('withholds the redirect when the directory reports as a link', () => {
    expect(handled('/sub', linkSite([at('sub', 'index.html')], [at('sub')]).deps)).toEqual(NOT_FOUND)
  })

  it('withholds the redirect when the index reports as a link', () => {
    expect(handled('/sub', linkSite([at('sub', 'index.html')], [at('sub', 'index.html')]).deps)).toEqual(NOT_FOUND)
  })

  it('asks about the file, then each directory below the root, and never the root', () => {
    const site = linkSite([at('a', 'b', 'c.txt')])
    handled('/a/b/c.txt', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'c.txt'), at('a', 'b'), at('a')])
  })

  it('asks about nothing for a missing file', () => {
    const site = linkSite([])
    handled('/a/b/missing.txt', site.deps)
    expect(site.asked).toEqual([])
  })

  it('asks about the index and each directory below the root before redirecting', () => {
    const site = linkSite([at('a', 'b', 'index.html')])
    handled('/a/b', site.deps)
    expect(site.asked).toEqual([at('a', 'b', 'index.html'), at('a', 'b'), at('a')])
  })

  it('never asks about a root spelled with a trailing separator', () => {
    const site = linkSite([at('sub', 'notes.txt')])
    handled('/sub/notes.txt', site.deps, `${ROOT}${sep}`)
    expect(site.asked).toEqual([at('sub', 'notes.txt'), at('sub')])
  })
})
