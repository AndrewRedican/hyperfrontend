import type { TypesExtractConfig } from './config'
import type { ExtractIo } from './index'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { extract, runTypesExtract } from './index'

const SHA = 'c'.repeat(40)

const CONFIG: TypesExtractConfig = {
  lockFile: 'lock.json',
  sources: { nx: { repo: 'o/r', ref: 'v1', include: ['src/'] } },
  requests: [{ source: 'nx', root: 'src/root.ts', symbols: ['Root'], depth: 1, output: 'out/root.ts' }],
  boundary: { default: 'unknown', overrides: {} },
  header: { tool: 'tool', regenerate: 'regen', check: 'check' },
  index: 'out/index.ts',
  indexModule: 'pkg/compat',
  report: 'out/REPORT.md',
  notice: 'out/NOTICE.md',
}

const UPSTREAM: Record<string, string> = {
  LICENSE: 'MIT\n\nCopyright (c) Someone.\n',
  'src/root.ts': "import { A } from './a'\nexport interface Root { a: A }",
  'src/a.ts': 'export interface A {}',
}

const LOCK_TEXT = `{\n  "sources": {\n    "nx": {\n      "repo": "o/r",\n      "ref": "v1",\n      "sha": "${SHA}"\n    }\n  }\n}\n`

/** A world with a disk, an upstream and a log. */
interface World {
  /** The run's io. */
  readonly io: ExtractIo
  /** The disk, by path. */
  readonly disk: Map<string, string>
  /** What was logged. */
  readonly log: string[]
  /** The URLs fetched. */
  readonly fetched: string[]
}

/**
 * A world over an in-memory disk and upstream.
 *
 * @param disk - The files on disk
 * @param upstream - The upstream files at the commit, by path
 * @param refs - API answers by URL
 * @returns The io with its disk, log and fetched URLs
 */
function worldOf(
  disk: Record<string, string> = {},
  upstream: Record<string, string> = UPSTREAM,
  refs: Record<string, unknown> = {}
): World {
  const files = createMap(Object.entries(disk))
  const log: string[] = []
  const fetched: string[] = []
  return {
    disk: files,
    log,
    fetched,
    io: {
      readFile: (path) => files.get(path) ?? null,
      writeFile: (path, text) => void files.set(path, text),
      fetchText: async (url) => {
        fetched.push(url)
        if (url in refs) return { status: 200, text: JSON.stringify(refs[url]) }
        const prefix = `https://raw.githubusercontent.com/o/r/${SHA}/`
        const path = url.startsWith(prefix) ? url.slice(prefix.length) : null
        return path !== null && path in upstream ? { status: 200, text: upstream[path] as string } : { status: 404, text: '' }
      },
      log: (line) => void log.push(line),
    },
  }
}

const TAG_URL = 'https://api.github.com/repos/o/r/git/ref/tags/v1'

describe('extract', () => {
  it('reads files until nothing is pending and generates every output', async () => {
    const world = worldOf()
    const generated = await extract(CONFIG, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)
    expect([...generated.keys()]).toEqual(['out/root.ts', 'out/index.ts', 'out/REPORT.md', 'out/NOTICE.md'])
  })

  it('logs each reading round', async () => {
    const world = worldOf()
    await extract(CONFIG, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)
    expect(world.log).toEqual(['reading 1 file', 'reading 4 files'])
  })

  it('carries the upstream copyright into the header', async () => {
    const world = worldOf()
    const generated = await extract(CONFIG, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)
    expect(generated.get('out/root.ts')).toContain(' * Copyright (c) Someone. Licensed under')
  })

  it('falls back to a generic copyright when the license has no copyright line', async () => {
    const world = worldOf({}, { ...UPSTREAM, LICENSE: 'Public domain\n' })
    const generated = await extract(CONFIG, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)
    expect(generated.get('out/root.ts')).toContain(' * Copyright of o/r. Licensed under')
  })

  it('reads a license file the source names', async () => {
    const world = worldOf({}, { ...UPSTREAM, 'LICENSE.md': 'MIT\n\nCopyright (c) Other.\n' })
    const config = { ...CONFIG, sources: { nx: { ...CONFIG.sources['nx'], license: 'LICENSE.md' } } } as TypesExtractConfig
    const generated = await extract(config, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)
    expect(generated.get('out/NOTICE.md')).toContain('Copyright (c) Other.')
  })

  it('throws when the repository has no license file', async () => {
    const world = worldOf({}, { 'src/root.ts': UPSTREAM['src/root.ts'] as string })
    await expect(extract(CONFIG, { sources: { nx: { repo: 'o/r', ref: 'v1', sha: SHA } } }, world.io)).rejects.toThrow(
      'nx: the repository has no LICENSE file at the locked commit'
    )
  })

  it('throws when the lock does not pin a configured source', async () => {
    await expect(extract(CONFIG, { sources: {} }, worldOf().io)).rejects.toThrow('the lock does not pin the source nx')
  })
})

describe('runTypesExtract', () => {
  it('rejects an invalid configuration', async () => {
    const world = worldOf()
    const code = await runTypesExtract({ ...CONFIG, requests: [] }, 'write', world.io)
    expect({ code, log: world.log }).toEqual({ code: 1, log: ['configuration: no requests are configured'] })
  })

  it('resolves the ref, writes every file and the lock when there is no lock', async () => {
    const world = worldOf({}, UPSTREAM, { [TAG_URL]: { object: { sha: SHA, type: 'commit' } } })
    const code = await runTypesExtract(CONFIG, 'write', world.io)
    expect({ code, files: [...world.disk.keys()], lock: world.disk.get('lock.json'), log: world.log }).toEqual({
      code: 0,
      files: ['out/root.ts', 'out/index.ts', 'out/REPORT.md', 'out/NOTICE.md', 'lock.json'],
      lock: LOCK_TEXT,
      log: [`nx: o/r@v1 is ${SHA}`, 'reading 1 file', 'reading 4 files', '5 of 5 files written'],
    })
  })

  it('uses the locked commit without resolving when the lock is current', async () => {
    const world = worldOf({ 'lock.json': LOCK_TEXT })
    await runTypesExtract(CONFIG, 'write', world.io)
    expect(world.fetched.includes(TAG_URL)).toBe(false)
  })

  it('writes only the files that changed', async () => {
    const world = worldOf({ 'lock.json': LOCK_TEXT })
    await runTypesExtract(CONFIG, 'write', world.io)
    const written = world.disk.get('out/root.ts') as string
    world.disk.set('out/root.ts', 'edited')
    world.log.length = 0
    await runTypesExtract(CONFIG, 'write', world.io)
    expect({ root: world.disk.get('out/root.ts'), log: world.log[world.log.length - 1] }).toEqual({
      root: written,
      log: '1 of 5 files written',
    })
  })

  it('re-resolves every source in update mode', async () => {
    const world = worldOf({ 'lock.json': LOCK_TEXT }, UPSTREAM, { [TAG_URL]: { object: { sha: SHA, type: 'commit' } } })
    await runTypesExtract(CONFIG, 'update', world.io)
    expect(world.fetched.includes(TAG_URL)).toBe(true)
  })

  it('fails a check when the lock is missing', async () => {
    const world = worldOf()
    const code = await runTypesExtract(CONFIG, 'check', world.io)
    expect({ code, log: world.log }).toEqual({ code: 1, log: ['lock.json does not pin nx as configured; run `regen` to resolve and lock'] })
  })

  it('passes a check when every generated file is current', async () => {
    const world = worldOf({ 'lock.json': LOCK_TEXT })
    await runTypesExtract(CONFIG, 'write', world.io)
    world.log.length = 0
    const code = await runTypesExtract(CONFIG, 'check', world.io)
    expect({ code, last: world.log[world.log.length - 1], disk: world.disk.size }).toEqual({
      code: 0,
      last: '4 generated files are current',
      disk: 5,
    })
  })

  it('fails a check naming missing and stale files', async () => {
    const world = worldOf({ 'lock.json': LOCK_TEXT })
    await runTypesExtract(CONFIG, 'write', world.io)
    world.disk.delete('out/NOTICE.md')
    world.disk.set('out/root.ts', 'edited')
    world.log.length = 0
    const code = await runTypesExtract(CONFIG, 'check', world.io)
    expect({ code, log: world.log.slice(-3) }).toEqual({
      code: 1,
      log: ['missing: out/NOTICE.md', 'stale: out/root.ts', 'run `regen` to regenerate'],
    })
  })
})
