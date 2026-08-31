import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverEntries } from './discover-entries'

const makeFixture = (): string => mkdtempSync(join(tmpdir(), 'builder-discover-'))

const writeEntry = (root: string, srcPath: string): void => {
  const dir = srcPath ? join(root, 'src', srcPath) : join(root, 'src')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.ts'), 'export {}\n')
}

describe('discoverEntries', () => {
  let root: string

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('classifies a single root entry as the root category', () => {
    root = makeFixture()
    writeEntry(root, '')
    expect(discoverEntries(root)).toEqual(
      expect.objectContaining({
        category: 'root',
        hasRootEntry: true,
        entryPoints: [expect.objectContaining({ exportPath: '.', isRoot: true })],
      })
    )
  })

  it('classifies browser/node only layouts as the platform category', () => {
    root = makeFixture()
    writeEntry(root, 'browser')
    writeEntry(root, 'node')
    expect(discoverEntries(root)).toEqual(
      expect.objectContaining({
        category: 'platform',
        hasRootEntry: false,
        entryPoints: expect.arrayContaining([
          expect.objectContaining({ exportPath: './browser', platform: 'browser' }),
          expect.objectContaining({ exportPath: './node', platform: 'node' }),
        ]),
      })
    )
  })

  it('classifies feature-only layouts as the feature category', () => {
    root = makeFixture()
    writeEntry(root, 'actions')
    writeEntry(root, 'events')
    expect(discoverEntries(root).category).toBe('feature')
  })

  it('classifies nested platform layouts as the complex category', () => {
    root = makeFixture()
    writeEntry(root, 'browser')
    writeEntry(root, 'browser/channel')
    expect(discoverEntries(root)).toEqual(
      expect.objectContaining({
        category: 'complex',
        platformEntries: expect.arrayContaining([expect.objectContaining({ exportPath: './browser/channel', platform: 'browser' })]),
      })
    )
  })

  it('classifies mixed root + feature layouts as the hybrid category', () => {
    root = makeFixture()
    writeEntry(root, '')
    writeEntry(root, 'actions')
    expect(discoverEntries(root).category).toBe('hybrid')
  })

  it('returns an empty discovery for projects without a src directory', () => {
    root = makeFixture()
    expect(discoverEntries(root)).toEqual(expect.objectContaining({ entryPoints: [], hasRootEntry: false, category: 'hybrid' }))
  })

  it('skips directories whose names start with a dot', () => {
    root = makeFixture()
    writeEntry(root, '.hidden')
    writeEntry(root, 'actions')
    expect(discoverEntries(root).entryPoints.map((e) => e.exportPath)).toEqual(['./actions'])
  })

  it('skips subdirectories that do not contain an index.ts', () => {
    root = makeFixture()
    mkdirSync(join(root, 'src', 'empty'), { recursive: true })
    expect(discoverEntries(root).entryPoints).toEqual([])
  })

  it('treats a non-directory at the src path as an empty layout', () => {
    root = makeFixture()
    writeFileSync(join(root, 'src'), '')
    expect(discoverEntries(root).entryPoints).toEqual([])
  })

  it('caps recursion at three levels deep', () => {
    root = makeFixture()
    writeEntry(root, 'a/b/c/d')
    expect(discoverEntries(root).entryPoints.map((e) => e.exportPath)).not.toContain('./a/b/c/d')
  })
})
