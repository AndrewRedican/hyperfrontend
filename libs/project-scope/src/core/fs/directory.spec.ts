import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readDirectory, readDirectoryRecursive, createDirectory, removeDirectory } from './directory'

const TEST_DIR = join(import.meta.dirname, '__test_dir_fixtures__')

describe('core/fs/directory', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'subdir'))
    mkdirSync(join(TEST_DIR, 'subdir', 'nested'))
    mkdirSync(join(TEST_DIR, '.hidden'))
    writeFileSync(join(TEST_DIR, 'file1.txt'), 'content1')
    writeFileSync(join(TEST_DIR, 'file2.txt'), 'content2')
    writeFileSync(join(TEST_DIR, '.dotfile'), 'hidden')
    writeFileSync(join(TEST_DIR, 'subdir', 'file3.txt'), 'content3')
    writeFileSync(join(TEST_DIR, 'subdir', 'nested', 'file4.txt'), 'content4')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('readDirectory', () => {
    it('lists directory contents', () => {
      const names = readDirectory(TEST_DIR).map((e) => e.name)
      expect(names).toEqual(expect.arrayContaining(['file1.txt', 'file2.txt', 'subdir']))
    })

    it('flags a file entry as a file', () => {
      const entries = readDirectory(TEST_DIR)
      expect(entries.find((e) => e.name === 'file1.txt')).toEqual(expect.objectContaining({ isFile: true, isDirectory: false }))
    })

    it('flags a subdirectory entry as a directory', () => {
      const entries = readDirectory(TEST_DIR)
      expect(entries.find((e) => e.name === 'subdir')).toEqual(expect.objectContaining({ isFile: false, isDirectory: true }))
    })

    it('throws for non-existent directory', () => {
      expect(() => readDirectory(join(TEST_DIR, 'missing'))).toThrow(/not found/)
    })

    it('throws for file path', () => {
      expect(() => readDirectory(join(TEST_DIR, 'file1.txt'))).toThrow(/Not a directory/)
    })
  })

  describe('readDirectoryRecursive', () => {
    it('lists all files recursively', () => {
      const names = readDirectoryRecursive(TEST_DIR, { includeHidden: true }).map((e) => e.name)
      expect(names).toEqual(expect.arrayContaining(['file1.txt', 'file3.txt', 'file4.txt']))
    })

    it('omits a hidden file by default', () => {
      const names = readDirectoryRecursive(TEST_DIR).map((e) => e.name)
      expect(names).not.toContain('.dotfile')
    })

    it('omits a hidden directory by default', () => {
      const names = readDirectoryRecursive(TEST_DIR).map((e) => e.name)
      expect(names).not.toContain('.hidden')
    })

    it('includes hidden files when option is set', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { includeHidden: true })
      const names = entries.map((e) => e.name)
      expect(names).toContain('.dotfile')
    })

    it('respects maxDepth option', () => {
      const names = readDirectoryRecursive(TEST_DIR, { maxDepth: 0 }).map((e) => e.name)
      expect(names.sort()).toEqual(['file1.txt', 'file2.txt', 'subdir'])
    })

    it('respects maxDepth: 1 to include subdir but not deeply nested', () => {
      const names = readDirectoryRecursive(TEST_DIR, { maxDepth: 1 }).map((e) => e.name)
      expect(names.sort()).toEqual(['file1.txt', 'file2.txt', 'file3.txt', 'nested', 'subdir'])
    })

    it('includes depth information', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { includeHidden: true })
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
      const dirPath = join(TEST_DIR, 'new-create-dir')
      const existedBefore = existsSync(dirPath)
      createDirectory(dirPath)
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: false, after: true })
    })

    it('creates nested directories by default', () => {
      const dirPath = join(TEST_DIR, 'new-a', 'new-b', 'new-c')
      createDirectory(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })
  })

  describe('removeDirectory', () => {
    it('removes empty directory with recursive option', () => {
      const dirPath = join(TEST_DIR, 'to-remove')
      mkdirSync(dirPath)
      const existedBefore = existsSync(dirPath)
      removeDirectory(dirPath, { recursive: true })
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: true, after: false })
    })

    it('removes directory with contents recursively', () => {
      const dirPath = join(TEST_DIR, 'to-remove-recursive')
      mkdirSync(dirPath)
      writeFileSync(join(dirPath, 'file.txt'), 'content')
      removeDirectory(dirPath, { recursive: true })
      expect(existsSync(dirPath)).toBe(false)
    })
  })

  describe('readDirectory error handling', () => {
    it('error has code FS_NOT_A_DIRECTORY when given file path', () => {
      expect(() => readDirectory(join(TEST_DIR, 'file1.txt'))).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Not a directory'),
          code: 'FS_NOT_A_DIRECTORY',
        })
      )
    })

    it('error context contains operation type', () => {
      expect(() => readDirectory(join(TEST_DIR, 'file1.txt'))).toThrow(
        expect.objectContaining({
          context: expect.objectContaining({
            operation: 'readdir',
          }),
        })
      )
    })
  })
})
