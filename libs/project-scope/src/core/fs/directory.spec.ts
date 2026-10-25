import { mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { readDirectory, readDirectoryRecursive, createDirectory, removeDirectory } from './directory'

describe('core/fs/directory', () => {
  const tempDir = useTempDir({ prefix: 'directory-test-', scope: 'all' })

  beforeAll(() => {
    mkdirSync(join(tempDir.path, 'subdir'))
    mkdirSync(join(tempDir.path, 'subdir', 'nested'))
    mkdirSync(join(tempDir.path, '.hidden'))
    writeFileSync(join(tempDir.path, 'file1.txt'), 'content1')
    writeFileSync(join(tempDir.path, 'file2.txt'), 'content2')
    writeFileSync(join(tempDir.path, '.dotfile'), 'hidden')
    writeFileSync(join(tempDir.path, 'subdir', 'file3.txt'), 'content3')
    writeFileSync(join(tempDir.path, 'subdir', 'nested', 'file4.txt'), 'content4')
    symlinkSync(tempDir.path, join(tempDir.path, 'subdir', 'nested', 'back'), 'dir')
  })

  describe('readDirectory', () => {
    it('lists directory contents', () => {
      const names = readDirectory(tempDir.path).map((e) => e.name)
      expect(names).toEqual(expect.arrayContaining(['file1.txt', 'file2.txt', 'subdir']))
    })

    it('flags a file entry as a file', () => {
      const entries = readDirectory(tempDir.path)
      expect(entries.find((e) => e.name === 'file1.txt')).toEqual(expect.objectContaining({ isFile: true, isDirectory: false }))
    })

    it('flags a subdirectory entry as a directory', () => {
      const entries = readDirectory(tempDir.path)
      expect(entries.find((e) => e.name === 'subdir')).toEqual(expect.objectContaining({ isFile: false, isDirectory: true }))
    })

    it('throws for non-existent directory', () => {
      expect(() => readDirectory(join(tempDir.path, 'missing'))).toThrow(/not found/)
    })

    it('throws for file path', () => {
      expect(() => readDirectory(join(tempDir.path, 'file1.txt'))).toThrow(/Not a directory/)
    })
  })

  describe('readDirectoryRecursive', () => {
    it('lists all files recursively', () => {
      const names = readDirectoryRecursive(tempDir.path, { includeHidden: true }).map((e) => e.name)
      expect(names).toEqual(expect.arrayContaining(['file1.txt', 'file3.txt', 'file4.txt']))
    })

    it('omits a hidden file by default', () => {
      const names = readDirectoryRecursive(tempDir.path).map((e) => e.name)
      expect(names).not.toContain('.dotfile')
    })

    it('omits a hidden directory by default', () => {
      const names = readDirectoryRecursive(tempDir.path).map((e) => e.name)
      expect(names).not.toContain('.hidden')
    })

    it('includes hidden files when option is set', () => {
      const entries = readDirectoryRecursive(tempDir.path, { includeHidden: true })
      const names = entries.map((e) => e.name)
      expect(names).toContain('.dotfile')
    })

    it('respects maxDepth option', () => {
      const names = readDirectoryRecursive(tempDir.path, { maxDepth: 0 }).map((e) => e.name)
      expect(names.sort()).toEqual(['file1.txt', 'file2.txt', 'subdir'])
    })

    it('respects maxDepth: 1 to include subdir but not deeply nested', () => {
      const names = readDirectoryRecursive(tempDir.path, { maxDepth: 1 }).map((e) => e.name)
      expect(names.sort()).toEqual(['file1.txt', 'file2.txt', 'file3.txt', 'nested', 'subdir'])
    })

    it('lists a symlinked directory as a symlink rather than a directory', () => {
      const entries = readDirectoryRecursive(tempDir.path)
      expect(entries.find((e) => e.name === 'back')).toMatchObject({ isSymlink: true, isDirectory: false, depth: 2 })
    })

    it('does not enter a symlinked directory by default', () => {
      const names = readDirectoryRecursive(tempDir.path).map((e) => e.name)
      expect(names.filter((name) => name === 'back' || name === 'file1.txt').sort()).toEqual(['back', 'file1.txt'])
    })

    it('walks each directory once when a followed symlink leads back into the tree', () => {
      const names = readDirectoryRecursive(tempDir.path, { followSymlinks: true }).map((e) => e.name)
      expect(names.sort()).toEqual(['back', 'file1.txt', 'file2.txt', 'file3.txt', 'file4.txt', 'nested', 'subdir'])
    })

    it('includes depth information', () => {
      const entries = readDirectoryRecursive(tempDir.path, { includeHidden: true })
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'file1.txt', depth: 0 }),
          expect.objectContaining({ name: 'file3.txt', depth: 1 }),
        ])
      )
    })
  })

  describe('createDirectory', () => {
    it('creates directory', () => {
      const dirPath = join(tempDir.path, 'new-create-dir')
      const existedBefore = existsSync(dirPath)
      createDirectory(dirPath)
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: false, after: true })
    })

    it('creates nested directories by default', () => {
      const dirPath = join(tempDir.path, 'new-a', 'new-b', 'new-c')
      createDirectory(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })
  })

  describe('removeDirectory', () => {
    it('removes empty directory with recursive option', () => {
      const dirPath = join(tempDir.path, 'to-remove')
      mkdirSync(dirPath)
      const existedBefore = existsSync(dirPath)
      removeDirectory(dirPath, { recursive: true })
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: true, after: false })
    })

    it('removes directory with contents recursively', () => {
      const dirPath = join(tempDir.path, 'to-remove-recursive')
      mkdirSync(dirPath)
      writeFileSync(join(dirPath, 'file.txt'), 'content')
      removeDirectory(dirPath, { recursive: true })
      expect(existsSync(dirPath)).toBe(false)
    })
  })

  describe('readDirectory error handling', () => {
    it('error has code FS_NOT_A_DIRECTORY when given file path', () => {
      expect(() => readDirectory(join(tempDir.path, 'file1.txt'))).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Not a directory'),
          code: 'FS_NOT_A_DIRECTORY',
        })
      )
    })

    it('error context contains operation type', () => {
      expect(() => readDirectory(join(tempDir.path, 'file1.txt'))).toThrow(
        expect.objectContaining({
          context: expect.objectContaining({
            operation: 'readdir',
          }),
        })
      )
    })
  })
})
