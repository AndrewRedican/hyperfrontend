import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeHeaderRule } from '../policy/serve-types'
import type { ServeStepDeps } from './serve-steps'
import { existsSync, realpathSync, symlinkSync } from 'node:fs'
import { join, parse, resolve } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir, useTempDir } from '@hyperfrontend/testing/fs'
import { runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'
import { realPathOnDisk, servedPath, storedFile } from './served-path'

// why: A volume that tells letter cases apart never reaches a file under another spelling, so the respelled cases can only run where the volume ignores case.
const volumeIgnoresCase = ((): boolean => {
  const probe = createTempDir({ prefix: 'hf-case-probe-' })
  try {
    probe.write('probe.txt', 'probe')
    return existsSync(probe.resolve('PROBE.TXT'))
  } finally {
    probe.remove()
  }
})()

const itWhereCaseIsIgnored = volumeIgnoresCase ? it : it.skip

const RULES: readonly ServeHeaderRule[] = [
  { headers: { 'X-Area': 'site' } },
  { prefix: '/host/', headers: { 'X-Area': 'host' } },
  { suffix: '.html', headers: { 'X-Kind': 'page' } },
]

// how: Runs one GET through the built-in pipeline over the disk and keeps the two headers the rules set.
const ruleHeaders = (root: string, url: string, deps?: ServeStepDeps): Record<string, string | undefined> => {
  const config: ResolvedServeConfig = { root, port: 4284, headers: RULES, log: false }
  const response = runSteps(buildServeSteps(config, deps), { method: 'GET', url, headers: {} }, { config })
  return { status: String(response.status), area: response.headers['X-Area'], kind: response.headers['X-Kind'] }
}

describe('realPathOnDisk', () => {
  const tmp = useTempDir({ prefix: 'hf-real-path-' })

  beforeEach(() => {
    tmp.write('site/host/index.html', 'HOST')
  })

  it('answers the stored path of a file that exists', () => {
    const stored = realpathSync.native(tmp.resolve('site', 'host', 'index.html'))
    expect(realPathOnDisk(tmp.resolve('site', 'host', 'index.html'))).toBe(stored)
  })

  it('answers the path it was asked when that is already the stored one', () => {
    const stored = join(realpathSync.native(tmp.path), 'site', 'host', 'index.html')
    expect(realPathOnDisk(stored)).toBe(stored)
  })

  it('answers null for a path that does not exist', () => {
    expect(realPathOnDisk(tmp.resolve('site', 'missing.html'))).toBeNull()
  })

  itWhereCaseIsIgnored('answers the stored letter case of a respelled path (needs a volume that ignores letter case)', () => {
    const stored = join(realpathSync.native(tmp.path), 'site', 'host', 'index.html')
    expect(realPathOnDisk(tmp.resolve('SITE', 'Host', 'INDEX.HTML'))).toBe(stored)
  })
})

describe('servedPath', () => {
  const root = resolve('/abs/dist')

  it('reads the path below the stored root in the stored spelling', () => {
    const stored = (path: string): string => (path === root ? root : join(root, 'host', 'index.html'))
    expect(servedPath(root, join(root, 'HOST', 'INDEX.HTML'), stored)).toBe('/host/index.html')
  })

  it('reads the path below a stored root that is the root of the file system', () => {
    const top = parse(root).root
    const stored = (path: string): string => (path === root ? top : join(top, 'host', 'index.html'))
    expect(servedPath(root, join(root, 'HOST', 'index.html'), stored)).toBe('/host/index.html')
  })

  it('answers the path as resolved when nothing is known of the stored one', () => {
    expect(servedPath(root, join(root, 'HOST', 'index.html'), () => null)).toBe('/HOST/index.html')
  })
})

describe('storedFile', () => {
  const root = resolve('/abs/dist')

  const asked = join(root, 'HOST', 'INDEX.HTML')

  const kept = join(root, 'host', 'index.html')

  const context = (): { config: ResolvedServeConfig } => ({ config: { root, port: 4284, headers: [], log: false } })

  // how: Answers the stored spelling of the root and of the one file, and records each path it was asked about.
  const recording = (): { lookups: string[]; realPath: (path: string) => string | null } => {
    const lookups: string[] = []
    return {
      lookups,
      realPath: (path) => {
        lookups.push(path)
        return path === root ? root : path === asked ? kept : null
      },
    }
  }

  it('answers the path below the root and the whole path, both as stored', () => {
    expect(storedFile(context(), asked, recording().realPath)).toEqual({ path: '/host/index.html', file: kept })
  })

  it('answers both as resolved when nothing is known of the stored root', () => {
    expect(storedFile(context(), asked, () => null)).toEqual({ path: '/HOST/INDEX.HTML', file: asked })
  })

  it('answers both as resolved when nothing is known of the stored file', () => {
    expect(storedFile(context(), asked, (path) => (path === root ? root : null))).toEqual({ path: '/HOST/INDEX.HTML', file: asked })
  })

  it('keeps the stored whole path of a file that is not stored below the root', () => {
    const elsewhere = resolve('/elsewhere/index.html')
    expect(storedFile(context(), asked, (path) => (path === root ? root : elsewhere))).toEqual({
      path: '/HOST/INDEX.HTML',
      file: elsewhere,
    })
  })

  it('asks about the root and the file once for one request, however many steps read the answer', () => {
    const volume = recording()
    const request = context()
    storedFile(request, asked, volume.realPath)
    storedFile(request, asked, volume.realPath)
    expect(volume.lookups).toEqual([root, asked])
  })

  it('answers a second reading with what the first was told', () => {
    const request = context()
    const first = storedFile(request, asked, recording().realPath)
    expect(storedFile(request, asked, () => null)).toBe(first)
  })

  it('asks again for the next request', () => {
    const volume = recording()
    storedFile(context(), asked, volume.realPath)
    storedFile(context(), asked, volume.realPath)
    expect(volume.lookups).toEqual([root, asked, root, asked])
  })

  it('asks again when one request is read for another file', () => {
    const volume = recording()
    const request = context()
    storedFile(request, asked, volume.realPath)
    storedFile(request, kept, volume.realPath)
    expect(volume.lookups).toEqual([root, asked, root, kept])
  })
})

describe('header rules over the disk', () => {
  const tmp = useTempDir({ prefix: 'hf-served-path-' })

  const site = (...segments: string[]): string => tmp.resolve('site', ...segments)

  beforeEach(() => {
    tmp.writeTree({
      'site/index.html': 'HOME',
      'site/app.js': 'app',
      'site/host/index.html': 'HOST',
      'site/host/app.js': 'host app',
      'site/host/deep/page.html': 'PAGE',
    })
    // why: A junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere.
    symlinkSync(site(), tmp.resolve('current'), 'junction')
  })

  it.each(['/', '/index.html', '/app.js', '/host/', '/host/index.html', '/host/app.js', '/host/deep/page.html', '/host', '/missing.html'])(
    'answers %s by its stored path exactly as by its resolved one when it is spelled as stored',
    (url: string) => {
      expect(ruleHeaders(site(), url)).toEqual(ruleHeaders(site(), url, { realPath: () => null }))
    }
  )

  it('sends a file below a prefix the rule bounded by that prefix', () => {
    expect(ruleHeaders(site(), '/host/app.js')).toEqual({ status: '200', area: 'host', kind: undefined })
  })

  it('matches the rules below a served root that is a link', () => {
    expect(ruleHeaders(tmp.resolve('current'), '/host/deep/page.html')).toEqual({ status: '200', area: 'host', kind: 'page' })
  })

  it('matches the rules below a served root spelled with a trailing separator', () => {
    expect(ruleHeaders(`${site()}/`, '/host/index.html')).toEqual({
      status: '200',
      area: 'host',
      kind: 'page',
    })
  })

  itWhereCaseIsIgnored('sends a respelled path the rules of the stored file (needs a volume that ignores letter case)', () => {
    expect(ruleHeaders(site(), '/HOST/INDEX.HTML')).toEqual({ status: '200', area: 'host', kind: 'page' })
  })

  itWhereCaseIsIgnored('sends a respelled directory url the rules of the stored index (needs a volume that ignores letter case)', () => {
    expect(ruleHeaders(site(), '/Host/')).toEqual({ status: '200', area: 'host', kind: 'page' })
  })

  itWhereCaseIsIgnored(
    'sends a respelled path below a linked root the rules of the stored file (needs a volume that ignores letter case)',
    () => {
      expect(ruleHeaders(tmp.resolve('current'), '/HOST/app.js')).toEqual({ status: '200', area: 'host', kind: undefined })
    }
  )
})
