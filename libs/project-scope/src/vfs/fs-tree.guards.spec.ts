import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createFsTree } from './fs-tree'

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_fstree_guards__')
const POISONED = `src/index${'\u0000'}.ts`

describe('vfs/FsTree - path guards', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const value = 42')
    symlinkSync(join(TEST_DIR, 'src'), join(TEST_DIR, 'src-link'), 'dir')
    // why: the parent of the tree root is outside it, so a link to it is the shortest escaping directory symlink.
    symlinkSync(import.meta.dirname, join(TEST_DIR, 'escape-dir'), 'dir')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('NUL byte rejection', () => {
    it('rejects a write to a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).write(POISONED, 'payload')).toThrow('Unsafe path (NUL byte)')
    })

    it('buffers no change for a rejected write', () => {
      const tree = createFsTree(TEST_DIR)

      expect(() => tree.write(POISONED, 'payload')).toThrow()
      expect(tree.listChanges()).toEqual([])
    })

    it('rejects a read of a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).read(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects an existence check on a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).exists(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects a delete of a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).delete(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('names the offending path in the rejection', () => {
      expect(() => createFsTree(TEST_DIR).write(POISONED, 'payload')).toThrow(/Unsafe path \(NUL byte\): src\/index/)
    })
  })

  describe('symlink validation on directory queries', () => {
    it('lists the entries behind an in-root directory symlink by default', () => {
      expect(createFsTree(TEST_DIR).children('src-link')).toEqual(['index.ts'])
    })

    it('refuses to list a directory symlink when followSymlinks is disabled', () => {
      expect(() => createFsTree(TEST_DIR, { followSymlinks: false }).children('src-link')).toThrow(
        'Cannot access symlink when followSymlinks is disabled'
      )
    })

    it('refuses to classify a directory symlink when followSymlinks is disabled', () => {
      expect(() => createFsTree(TEST_DIR, { followSymlinks: false }).isDirectory('src-link')).toThrow(
        'Cannot access symlink when followSymlinks is disabled'
      )
    })

    it('refuses to list a directory symlink whose target escapes the root', () => {
      expect(() => createFsTree(TEST_DIR).children('escape-dir')).toThrow('Symlink target escapes tree root')
    })

    it('refuses to classify a directory symlink whose target escapes the root', () => {
      expect(() => createFsTree(TEST_DIR).isDirectory('escape-dir')).toThrow('Symlink target escapes tree root')
    })

    it('still lists a real directory when followSymlinks is disabled', () => {
      expect(createFsTree(TEST_DIR, { followSymlinks: false }).children('src')).toEqual(['index.ts'])
    })

    it('still classifies a real directory when followSymlinks is disabled', () => {
      expect(createFsTree(TEST_DIR, { followSymlinks: false }).isDirectory('src')).toBe(true)
    })
  })
})
