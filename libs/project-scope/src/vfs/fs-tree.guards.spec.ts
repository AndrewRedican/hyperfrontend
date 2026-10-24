import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createFsTree } from './fs-tree'

const POISONED = `src/index${'\u0000'}.ts`

describe('vfs/FsTree - path guards', () => {
  const tempDir = useTempDir({ prefix: 'fstree-guards-test-', scope: 'all' })

  beforeAll(() => {
    mkdirSync(join(tempDir.path, 'src'), { recursive: true })
    writeFileSync(join(tempDir.path, 'src', 'index.ts'), 'export const value = 42')
    symlinkSync(join(tempDir.path, 'src'), join(tempDir.path, 'src-link'), 'dir')
    // why: the parent of the tree root is outside it, so a link to it is the shortest escaping directory symlink.
    symlinkSync(dirname(tempDir.path), join(tempDir.path, 'escape-dir'), 'dir')
  })

  describe('NUL byte rejection', () => {
    it('rejects a write to a path carrying a NUL byte', () => {
      expect(() => createFsTree(tempDir.path).write(POISONED, 'payload')).toThrow('Unsafe path (NUL byte)')
    })

    it('buffers no change for a rejected write', () => {
      const tree = createFsTree(tempDir.path)

      // why: the rejection itself is pinned by the test above; swallowing it here leaves only the buffer to inspect.
      try {
        tree.write(POISONED, 'payload')
      } catch {
        // why: a write that did not throw would show up in the buffer below.
      }

      expect(tree.listChanges()).toEqual([])
    })

    it('rejects a read of a path carrying a NUL byte', () => {
      expect(() => createFsTree(tempDir.path).read(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects an existence check on a path carrying a NUL byte', () => {
      expect(() => createFsTree(tempDir.path).exists(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects a delete of a path carrying a NUL byte', () => {
      expect(() => createFsTree(tempDir.path).delete(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('names the offending path in the rejection', () => {
      expect(() => createFsTree(tempDir.path).write(POISONED, 'payload')).toThrow(/Unsafe path \(NUL byte\): src\/index/)
    })
  })

  describe('symlink validation on directory queries', () => {
    it('lists the entries behind an in-root directory symlink by default', () => {
      expect(createFsTree(tempDir.path).children('src-link')).toEqual(['index.ts'])
    })

    it('refuses to list a directory symlink when followSymlinks is disabled', () => {
      expect(() => createFsTree(tempDir.path, { followSymlinks: false }).children('src-link')).toThrow(
        'Cannot access symlink when followSymlinks is disabled'
      )
    })

    it('refuses to classify a directory symlink when followSymlinks is disabled', () => {
      expect(() => createFsTree(tempDir.path, { followSymlinks: false }).isDirectory('src-link')).toThrow(
        'Cannot access symlink when followSymlinks is disabled'
      )
    })

    it('refuses to list a directory symlink whose target escapes the root', () => {
      expect(() => createFsTree(tempDir.path).children('escape-dir')).toThrow('Symlink target escapes tree root')
    })

    it('refuses to classify a directory symlink whose target escapes the root', () => {
      expect(() => createFsTree(tempDir.path).isDirectory('escape-dir')).toThrow('Symlink target escapes tree root')
    })

    it('still lists a real directory when followSymlinks is disabled', () => {
      expect(createFsTree(tempDir.path, { followSymlinks: false }).children('src')).toEqual(['index.ts'])
    })

    it('still classifies a real directory when followSymlinks is disabled', () => {
      expect(createFsTree(tempDir.path, { followSymlinks: false }).isDirectory('src')).toBe(true)
    })
  })
})
