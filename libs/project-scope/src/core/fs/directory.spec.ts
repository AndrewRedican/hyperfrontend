import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readDirectory, readDirectoryRecursive, createDirectory, removeDirectory } from './directory'

const TEST_DIR = join(__dirname, '__test_dir_fixtures__')

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
      const entries = readDirectory(TEST_DIR)
      expect(entries.length).toBeGreaterThan(0)
      const names = entries.map((e) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('file2.txt')
      expect(names).toContain('subdir')
    })

    it('includes file type information', () => {
      const entries = readDirectory(TEST_DIR)
      const file = entries.find((e) => e.name === 'file1.txt')
      const dir = entries.find((e) => e.name === 'subdir')
      expect(file?.isFile).toBe(true)
      expect(file?.isDirectory).toBe(false)
      expect(dir?.isFile).toBe(false)
      expect(dir?.isDirectory).toBe(true)
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
      const entries = readDirectoryRecursive(TEST_DIR, { includeHidden: true })
      const names = entries.map((e) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('file3.txt')
      expect(names).toContain('file4.txt')
    })

    it('filters hidden files by default', () => {
      const entries = readDirectoryRecursive(TEST_DIR)
      const names = entries.map((e) => e.name)
      expect(names).not.toContain('.dotfile')
      expect(names).not.toContain('.hidden')
    })

    it('includes hidden files when option is set', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { includeHidden: true })
      const names = entries.map((e) => e.name)
      expect(names).toContain('.dotfile')
    })

    it('respects maxDepth option', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { maxDepth: 0 })
      const names = entries.map((e) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('subdir')
      expect(names).not.toContain('file3.txt')
    })

    it('respects maxDepth: 1 to include subdir but not deeply nested', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { maxDepth: 1 })
      const names = entries.map((e) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('subdir')
      expect(names).toContain('file3.txt')
      expect(names).not.toContain('file4.txt')
    })

    it('includes depth information', () => {
      const entries = readDirectoryRecursive(TEST_DIR, { includeHidden: true })
      const file1 = entries.find((e) => e.name === 'file1.txt')
      const file3 = entries.find((e) => e.name === 'file3.txt')
      expect(file1?.depth).toBe(0)
      expect(file3?.depth).toBe(1)
    })
  })

  describe('createDirectory', () => {
    it('creates directory', () => {
      const dirPath = join(TEST_DIR, 'new-create-dir')
      expect(existsSync(dirPath)).toBe(false)
      createDirectory(dirPath)
      expect(existsSync(dirPath)).toBe(true)
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
      expect(existsSync(dirPath)).toBe(true)
      removeDirectory(dirPath, { recursive: true })
      expect(existsSync(dirPath)).toBe(false)
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
