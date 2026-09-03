import type { MockedFunction } from '@hyperfrontend/testing'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { commitChanges, rollbackChanges } from './commit'
import { createFsTree } from './fs-tree'

// why: the module under test binds `writeFileSync` when it links, so no property replacement on the namespace can reach it. Replacing the module is what makes the write failure reachable, and the replacement calls through until a test says otherwise.
jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs')
  return { ...actual, writeFileSync: jest.fn(actual.writeFileSync) }
})

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_commit__')

describe('vfs/commit', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }))
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const hello = "world"')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('commitChanges', () => {
    it('creates new files on disk', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'new content')
      const result = commitChanges(tree)

      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.deleted).toBe(0)
      expect(existsSync(join(TEST_DIR, 'new-file.txt'))).toBe(true)
      expect(readFileSync(join(TEST_DIR, 'new-file.txt'), 'utf-8')).toBe('new content')
    })

    it('updates existing files on disk', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', '{"updated": true}')
      const result = commitChanges(tree)

      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)
      expect(readFileSync(join(TEST_DIR, 'package.json'), 'utf-8')).toBe('{"updated": true}')
    })

    it('deletes files from disk', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const result = commitChanges(tree)

      expect(result.deleted).toBe(1)
      expect(existsSync(join(TEST_DIR, 'package.json'))).toBe(false)
    })

    it('creates parent directories', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('deep/nested/path/file.txt', 'deep content')
      commitChanges(tree)

      expect(existsSync(join(TEST_DIR, 'deep', 'nested', 'path', 'file.txt'))).toBe(true)
    })

    it('handles multiple changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', 'new')
      tree.write('package.json', 'updated')
      tree.delete('src/index.ts')
      const result = commitChanges(tree)

      expect(result.created).toBe(1)
      expect(result.updated).toBe(1)
      expect(result.deleted).toBe(1)
      expect(result.changes).toHaveLength(3)
    })

    it('clears changes after commit', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file.txt', 'content')
      commitChanges(tree)

      expect(tree.listChanges()).toEqual([])
    })

    it('sets dryRun flag in result', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file.txt', 'content')
      const result = commitChanges(tree)
      expect(result.dryRun).toBe(false)
    })

    it('applies file permissions', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('script.sh', '#!/bin/bash\necho "hello"', { permissions: 0o755 })
      commitChanges(tree)

      const stat = statSync(join(TEST_DIR, 'script.sh'))
      expect(stat.mode & 0o111).toBeGreaterThan(0)
    })
  })

  describe('commitChanges dry run', () => {
    it('reports changes without writing', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'content')
      tree.delete('package.json')
      const result = commitChanges(tree, { dryRun: true })

      expect(result.dryRun).toBe(true)
      expect(result.created).toBe(1)
      expect(result.deleted).toBe(1)
      expect(existsSync(join(TEST_DIR, 'new-file.txt'))).toBe(false)
      expect(existsSync(join(TEST_DIR, 'package.json'))).toBe(true)
    })

    it('reports updates in dry run', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', '{"updated": true}')
      const result = commitChanges(tree, { dryRun: true })

      expect(result.dryRun).toBe(true)
      expect(result.updated).toBe(1)
      expect(readFileSync(join(TEST_DIR, 'package.json'), 'utf-8')).toContain('test')
    })

    it('preserves changes after dry run', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file.txt', 'content')
      commitChanges(tree, { dryRun: true })

      expect(tree.listChanges()).toHaveLength(1)
    })
  })

  describe('commitChanges verbose mode', () => {
    it('does not throw with verbose option', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file.txt', 'content')
      expect(() => commitChanges(tree, { verbose: true })).not.toThrow()
    })
  })

  describe('rollbackChanges', () => {
    it('clears all pending changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file1.txt', 'content1')
      tree.write('file2.txt', 'content2')
      tree.delete('package.json')
      rollbackChanges(tree)

      expect(tree.listChanges()).toEqual([])
    })

    it('restores disk state visibility', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.exists('package.json')).toBe(false)

      rollbackChanges(tree)
      expect(tree.exists('package.json')).toBe(true)
    })

    it('removes buffered writes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', 'content')
      expect(tree.exists('new.txt')).toBe(true)

      rollbackChanges(tree)
      expect(tree.exists('new.txt')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty changes', () => {
      const tree = createFsTree(TEST_DIR)
      const result = commitChanges(tree)
      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.deleted).toBe(0)
      expect(result.changes).toEqual([])
    })

    it('handles rename via delete and create', () => {
      const tree = createFsTree(TEST_DIR)
      tree.rename('package.json', 'pkg.json')
      const result = commitChanges(tree)

      expect(result.created).toBe(1)
      expect(result.deleted).toBe(1)
      expect(existsSync(join(TEST_DIR, 'package.json'))).toBe(false)
      expect(existsSync(join(TEST_DIR, 'pkg.json'))).toBe(true)
    })

    it('handles binary content', () => {
      const tree = createFsTree(TEST_DIR)
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff])
      tree.write('binary.bin', buffer)
      commitChanges(tree)

      const content = readFileSync(join(TEST_DIR, 'binary.bin'))
      expect(content).toEqual(buffer)
    })

    it('handles directory deletion', () => {
      mkdirSync(join(TEST_DIR, 'to-delete'), { recursive: true })
      writeFileSync(join(TEST_DIR, 'to-delete', 'file.txt'), 'content')

      const tree = createFsTree(TEST_DIR)
      tree.delete('to-delete')
      const result = commitChanges(tree)

      expect(result.deleted).toBe(1)
      expect(existsSync(join(TEST_DIR, 'to-delete'))).toBe(false)
    })

    it('handles deleting non-existent file during commit', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('temp.txt', 'content')
      commitChanges(tree)

      const tree2 = createFsTree(TEST_DIR)
      tree2.delete('temp.txt')
      rmSync(join(TEST_DIR, 'temp.txt'), { force: true })

      expect(() => commitChanges(tree2)).not.toThrow()
    })

    it('throws contextual error when commit fails with Error instance', () => {
      const tree = createFsTree(TEST_DIR)
      const blockerDir = join(TEST_DIR, 'blocker-file')
      mkdirSync(blockerDir, { recursive: true })
      writeFileSync(join(blockerDir, 'inner.txt'), 'content')

      tree.write('blocker-file', 'content')

      expect(() => commitChanges(tree)).toThrow(/Failed to update blocker-file/)
    })

    it('handles DELETE change where unlinkSync succeeds for regular file', () => {
      writeFileSync(join(TEST_DIR, 'regular-file.txt'), 'content')
      const tree = createFsTree(TEST_DIR)
      tree.delete('regular-file.txt')
      const result = commitChanges(tree)

      expect(result.deleted).toBe(1)
      expect(existsSync(join(TEST_DIR, 'regular-file.txt'))).toBe(false)
    })

    it('throws contextual error when commit fails with non-Error throwable', () => {
      const mockWriteFileSync = (writeFileSync as MockedFunction<typeof writeFileSync>).mockImplementationOnce(() => {
        throw 'string error'
      })

      const tree = createFsTree(TEST_DIR)
      tree.write('will-fail.txt', 'content')

      expect(() => commitChanges(tree)).toThrow(/Failed to create will-fail.txt/)

      mockWriteFileSync.mockRestore()
    })
  })
})
