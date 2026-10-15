import type { FileChange } from './types'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { normalizePath } from '../core/path'
import { createFsTree } from './fs-tree'
import { Mode } from './types'

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_fstree__')

describe('vfs/FsTree', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'lib'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }))
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const hello = "world"')
    writeFileSync(join(TEST_DIR, 'src', 'utils.ts'), 'export function add(a: number, b: number) { return a + b }')
    writeFileSync(join(TEST_DIR, 'lib', 'helper.js'), 'module.exports = {}')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('constructor', () => {
    it('creates tree with root path', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.root).toBe(normalizePath(TEST_DIR))
    })

    it('normalizes root path', () => {
      const tree = createFsTree(TEST_DIR + sep)
      expect(tree.root).toBe(normalizePath(TEST_DIR))
    })
  })

  describe('factory function', () => {
    it('createFsTree returns object with Tree interface', () => {
      const tree = createFsTree(TEST_DIR)
      expect(Object.keys(tree)).toEqual(
        expect.arrayContaining([
          'root',
          'read',
          'write',
          'exists',
          'delete',
          'rename',
          'isFile',
          'isDirectory',
          'isSymlink',
          'children',
          'listChanges',
          'changePermissions',
          'changeFile',
          'clearChanges',
        ])
      )
    })

    it('returns plain object, not class instance', () => {
      const tree = createFsTree(TEST_DIR)
      expect(Object.getPrototypeOf(tree)).toBe(Object.prototype)
    })

    it('does not expose internal state', () => {
      const tree = createFsTree(TEST_DIR)
      const internals = ['_root', '_changes', '_isVerbose', '_followSymlinks', '_changesLog', '_clearChanges', '_getChangesLog']
      expect(internals.filter((key) => key in tree)).toEqual([])
    })
  })

  describe('read', () => {
    it('reads file from disk as Buffer', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.read('package.json')).toEqual(Buffer.from('{"name":"test"}'))
    })

    it('reads file from disk as string', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.read('package.json', 'utf-8')).toBe('{"name":"test"}')
    })

    it('reads file in subdirectory', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('src/index.ts', 'utf-8')
      expect(content).toContain('hello')
    })

    it('returns null for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('non-existent.txt')
      expect(content).toBeNull()
    })

    it('reads file using absolute path within root', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read(join(TEST_DIR, 'package.json'), 'utf-8')
      expect(content).toContain('test')
    })

    it('returns null for directory', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('src')
      expect(content).toBeNull()
    })

    it('reads buffered content after write', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'buffered content')
      const content = tree.read('new-file.txt', 'utf-8')
      expect(content).toBe('buffered content')
    })

    it('returns null after delete', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const content = tree.read('package.json')
      expect(content).toBeNull()
    })
  })

  describe('write', () => {
    it('buffers new file write', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'new content')
      expect(tree.listChanges()).toEqual([expect.objectContaining({ type: 'CREATE', path: 'new-file.txt' })])
    })

    it('buffers file update', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', '{"updated": true}')
      expect(tree.listChanges()).toEqual([expect.objectContaining({ type: 'UPDATE', originalContent: expect.any(Buffer) })])
    })

    it('creates nested directories in changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('deep/nested/path/file.txt', 'content')
      expect(tree.exists('deep/nested/path/file.txt')).toBe(true)
    })

    it('throws with ExclusiveCreate mode for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.write('package.json', 'content', { mode: Mode.ExclusiveCreate })).toThrow(/already exists/)
    })

    it('skips write with SkipIfExists mode', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', 'new content', { mode: Mode.SkipIfExists })
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('stores permissions when provided', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('script.sh', '#!/bin/bash', { permissions: 0o755 })
      const changes = tree.listChanges()
      const first = changes[0] as FileChange
      expect(first.mode).toBe(0o755)
    })

    it('handles Buffer content', () => {
      const tree = createFsTree(TEST_DIR)
      const buffer = Buffer.from('binary content')
      tree.write('binary.bin', buffer)
      const content = tree.read('binary.bin')
      expect(content).toEqual(buffer)
    })
  })

  describe('exists', () => {
    it('returns true for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('package.json')).toBe(true)
    })

    it('returns true for existing directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('src')).toBe(true)
    })

    it('returns false for non-existent path', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('non-existent')).toBe(false)
    })

    it('returns true for buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'content')
      expect(tree.exists('new-file.txt')).toBe(true)
    })

    it('returns false for deleted file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.exists('package.json')).toBe(false)
    })

    it('returns true for implied directory from buffered files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-dir/file.txt', 'content')
      expect(tree.exists('new-dir')).toBe(true)
    })
  })

  describe('delete', () => {
    it('buffers file deletion', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.listChanges()).toEqual([expect.objectContaining({ type: 'DELETE', path: 'package.json' })])
    })

    it('removes newly created file from changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('temp.txt', 'content')
      tree.delete('temp.txt')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('no-op for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('non-existent.txt')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('stores original content', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const first = tree.listChanges()[0] as FileChange
      expect(first.originalContent?.toString()).toContain('test')
    })
  })

  describe('rename', () => {
    it('renames file via write and delete', () => {
      const tree = createFsTree(TEST_DIR)
      tree.rename('package.json', 'package-backup.json')
      const changes = tree
        .listChanges()
        .map((c) => `${c.type} ${c.path}`)
        .sort()
      expect(changes).toEqual(['CREATE package-backup.json', 'DELETE package.json'])
    })

    it('throws for non-existent source', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.rename('missing.txt', 'other.txt')).toThrow(/Source file not found/)
    })

    it('renames buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('temp.txt', 'content')
      tree.rename('temp.txt', 'renamed.txt')
      const present = { 'temp.txt': tree.exists('temp.txt'), 'renamed.txt': tree.exists('renamed.txt') }
      expect(present).toEqual({ 'temp.txt': false, 'renamed.txt': true })
    })
  })

  describe('isFile', () => {
    it('returns true for file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isFile('package.json')).toBe(true)
    })

    it('returns false for directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isFile('src')).toBe(false)
    })

    it('returns true for buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'content')
      expect(tree.isFile('new-file.txt')).toBe(true)
    })

    it('returns false for deleted file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.isFile('package.json')).toBe(false)
    })
  })

  describe('isDirectory', () => {
    it('returns true for directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isDirectory('src')).toBe(true)
    })

    it('returns false for file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isDirectory('package.json')).toBe(false)
    })

    it('returns true for implied directory', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-dir/file.txt', 'content')
      expect(tree.isDirectory('new-dir')).toBe(true)
    })
  })

  describe('children', () => {
    it('lists directory children from disk', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.children('src')).toEqual(expect.arrayContaining(['index.ts', 'utils.ts']))
    })

    it('returns sorted children', () => {
      const tree = createFsTree(TEST_DIR)
      const children = tree.children('src')
      expect(children).toEqual([...children].sort())
    })

    it('includes buffered files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('src/new-file.ts', 'content')
      const children = tree.children('src')
      expect(children).toContain('new-file.ts')
    })

    it('excludes deleted files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('src/index.ts')
      const children = tree.children('src')
      expect(children).not.toContain('index.ts')
    })

    it('handles root directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.children('.')).toEqual(expect.arrayContaining(['package.json', 'src']))
    })

    it('includes implied nested directories', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-top/nested/file.txt', 'content')
      const children = tree.children('.')
      expect(children).toContain('new-top')
    })
  })

  describe('listChanges', () => {
    it('returns empty array initially', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.listChanges()).toEqual([])
    })

    it('returns sorted changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('z-file.txt', 'z')
      tree.write('a-file.txt', 'a')
      expect(tree.listChanges().map((c) => c.path)).toEqual(['a-file.txt', 'z-file.txt'])
    })

    it('includes all change types', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', 'new')
      tree.write('package.json', 'updated')
      tree.delete('src/utils.ts')
      const changes = tree.listChanges()
      expect(changes.map((c) => c.type).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE'])
    })
  })

  describe('changePermissions', () => {
    it('sets permissions for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.changePermissions('package.json', 0o755)
      expect(tree.listChanges()).toEqual([expect.objectContaining({ path: 'package.json', mode: 0o755 })])
    })

    it('throws for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.changePermissions('missing.txt', 0o755)).toThrow(/File not found/)
    })

    it('updates permissions on buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('script.sh', '#!/bin/bash')
      tree.changePermissions('script.sh', 0o755)
      expect(tree.listChanges()).toEqual([expect.objectContaining({ path: 'script.sh', mode: 0o755 })])
    })
  })

  describe('changeFile', () => {
    it('transforms file content', () => {
      const tree = createFsTree(TEST_DIR)
      tree.changeFile('package.json', (content) => {
        const json = JSON.parse(content.toString())
        json.modified = true
        return Buffer.from(JSON.stringify(json))
      })
      const content = tree.read('package.json', 'utf-8')
      expect(content).toContain('modified')
    })

    it('throws for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.changeFile('missing.txt', (c) => c)).toThrow(/File not found/)
    })
  })

  describe('clearChanges', () => {
    it('clears all buffered changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file1.txt', 'a')
      tree.write('file2.txt', 'b')
      tree.clearChanges()
      expect(tree.listChanges()).toEqual([])
    })
  })

  describe('security: path traversal prevention', () => {
    describe('read operations', () => {
      it('throws error when path traverses outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('throws error when absolute path is outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('/etc/passwd')).toThrow('Path escapes tree root')
      })

      it('prevents nested path traversal attempts', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/../../../../../../proc/self/environ')).toThrow('Path escapes tree root')
      })

      it('allows reading root directory itself', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('.')).not.toThrow()
      })

      it.each(['package.json', 'src/index.ts'])('allows reading %s within root', (filePath) => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read(filePath)).not.toThrow()
      })
    })

    describe('write operations', () => {
      it('throws error when writing outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('../../../tmp/malicious.txt', 'bad content')).toThrow('Path escapes tree root')
      })

      it('throws error when writing to absolute path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write(join(tmpdir(), 'malicious.txt'), 'bad content')).toThrow('Path escapes tree root')
      })

      it('prevents nested path traversal in write', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('src/../../../../../../tmp/bad.txt', 'content')).toThrow('Path escapes tree root')
      })

      it.each(['new-file.txt', 'src/new.ts'])('allows writing %s within root', (filePath) => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write(filePath, 'content')).not.toThrow()
      })
    })

    describe('delete operations', () => {
      it('throws error when deleting outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('../../../tmp/important.txt')).toThrow('Path escapes tree root')
      })

      it('throws error when deleting absolute path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('/etc/important')).toThrow('Path escapes tree root')
      })

      it('allows deleting files within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('package.json')).not.toThrow()
      })
    })

    describe('directory operations', () => {
      it('throws error when listing children outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('../../../etc')).toThrow('Path escapes tree root')
      })

      it('throws error when checking isDirectory outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isDirectory('../../../etc')).toThrow('Path escapes tree root')
      })

      it('throws error when checking isFile outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isFile('../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('allows listing a directory within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('src')).not.toThrow()
      })

      it('allows checking isDirectory within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isDirectory('src')).not.toThrow()
      })

      it('allows checking isFile within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isFile('package.json')).not.toThrow()
      })
    })

    describe('other file operations', () => {
      it('throws error when renaming to path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('package.json', '../../../tmp/moved.json')).toThrow('Path escapes tree root')
      })

      it('throws error when renaming from path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('../../../etc/passwd', 'copied.txt')).toThrow('Path escapes tree root')
      })

      it('allows rename operations within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('package.json', 'package-renamed.json')).not.toThrow()
      })
    })

    describe('edge cases', () => {
      it('handles multiple consecutive ../ segments', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('../../../../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('handles ../ at the end of path', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/../..')).toThrow('Path escapes tree root')
      })

      it('handles mixed / and ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/nested/../../..')).toThrow('Path escapes tree root')
      })

      it('allows accessing root with .', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('.')).not.toThrow()
      })

      it('allows accessing root with empty string', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('')).not.toThrow()
      })
    })
  })

  describe('additional edge case coverage', () => {
    describe('read after delete', () => {
      it('returns null for file marked as deleted in buffer', () => {
        const tree = createFsTree(TEST_DIR)
        const observed: unknown[] = [tree.exists('package.json')]

        tree.delete('package.json')
        observed.push(tree.read('package.json'))

        expect(observed).toEqual([true, null])
      })

      it('returns null for file deleted then read with encoding', () => {
        const tree = createFsTree(TEST_DIR)
        tree.delete('package.json')
        const content = tree.read('package.json', 'utf-8')
        expect(content).toBeNull()
      })
    })

    describe('reading directory path', () => {
      it('returns null when reading a directory path', () => {
        const tree = createFsTree(TEST_DIR)
        const content = tree.read('src')
        expect(content).toBeNull()
      })
    })

    describe('delete non-existent file variations', () => {
      it('is no-op for file that never existed on disk', () => {
        const tree = createFsTree(TEST_DIR)
        tree.delete('completely-nonexistent-file-12345.txt')
        const changes = tree.listChanges()
        expect(changes).toHaveLength(0)
      })
    })

    describe('rename with missing source variations', () => {
      it('throws when source file does not exist on disk', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => {
          tree.rename('nonexistent-source-54321.txt', 'destination.txt')
        }).toThrow('Source file not found')
      })

      it('throws when source was deleted in buffer', () => {
        const tree = createFsTree(TEST_DIR)
        tree.delete('package.json')
        expect(() => {
          tree.rename('package.json', 'backup.json')
        }).toThrow('Source file not found')
      })
    })

    describe('path escape with root-equal paths', () => {
      it('reports the root itself as existing', () => {
        const tree = createFsTree(TEST_DIR)
        expect(tree.exists('.')).toBe(true)
      })

      it('classifies the root itself as a directory', () => {
        const tree = createFsTree(TEST_DIR)
        expect(tree.isDirectory('.')).toBe(true)
      })

      it('throws when normalized path equals parent of root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('..')).toThrow('Path escapes tree root')
      })
    })
  })
})
