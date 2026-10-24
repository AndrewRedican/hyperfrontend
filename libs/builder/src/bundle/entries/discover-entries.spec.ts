import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { discoverEntries } from './discover-entries'

describe('discoverEntries', () => {
  const root = useTempDir({ prefix: 'builder-discover-' })

  const writeEntry = (srcPath: string): string => root.write(join('src', srcPath, 'index.ts'), 'export {}\n')

  it('classifies a single root entry as the root category', () => {
    writeEntry('')
    expect(discoverEntries(root.path)).toEqual(
      expect.objectContaining({
        category: 'root',
        hasRootEntry: true,
        entryPoints: [expect.objectContaining({ exportPath: '.', isRoot: true })],
      })
    )
  })

  it('classifies browser/node only layouts as the platform category', () => {
    writeEntry('browser')
    writeEntry('node')
    expect(discoverEntries(root.path)).toEqual(
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
    writeEntry('actions')
    writeEntry('events')
    expect(discoverEntries(root.path).category).toBe('feature')
  })

  it('classifies nested platform layouts as the complex category', () => {
    writeEntry('browser')
    writeEntry('browser/channel')
    expect(discoverEntries(root.path)).toEqual(
      expect.objectContaining({
        category: 'complex',
        platformEntries: expect.arrayContaining([expect.objectContaining({ exportPath: './browser/channel', platform: 'browser' })]),
      })
    )
  })

  it('classifies mixed root + feature layouts as the hybrid category', () => {
    writeEntry('')
    writeEntry('actions')
    expect(discoverEntries(root.path).category).toBe('hybrid')
  })

  it('returns an empty discovery for projects without a src directory', () => {
    expect(discoverEntries(root.path)).toEqual(expect.objectContaining({ entryPoints: [], hasRootEntry: false, category: 'hybrid' }))
  })

  it('skips directories whose names start with a dot', () => {
    writeEntry('.hidden')
    writeEntry('actions')
    expect(discoverEntries(root.path).entryPoints.map((e) => e.exportPath)).toEqual(['./actions'])
  })

  it('skips subdirectories that do not contain an index.ts', () => {
    root.mkdir('src/empty')
    expect(discoverEntries(root.path).entryPoints).toEqual([])
  })

  it('treats a non-directory at the src path as an empty layout', () => {
    root.write('src', '')
    expect(discoverEntries(root.path).entryPoints).toEqual([])
  })

  it('caps recursion at three levels deep', () => {
    writeEntry('a/b/c/d')
    expect(discoverEntries(root.path).entryPoints.map((e) => e.exportPath)).not.toContain('./a/b/c/d')
  })
})
