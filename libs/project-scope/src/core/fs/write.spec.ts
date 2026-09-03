import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { writeFileContent, writeFileBuffer, writeJsonFile, ensureDir } from './write'

const TEST_DIR = join(import.meta.dirname, '__test_write_fixtures__')

describe('core/fs/write', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('ensureDir', () => {
    it('creates directory if not exists', () => {
      const dirPath = join(TEST_DIR, 'new-dir')
      expect(existsSync(dirPath)).toBe(false)
      ensureDir(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })

    it('creates nested directories', () => {
      const dirPath = join(TEST_DIR, 'a', 'b', 'c')
      expect(existsSync(dirPath)).toBe(false)
      ensureDir(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })

    it('does nothing if directory exists', () => {
      const dirPath = join(TEST_DIR, 'existing-dir')
      mkdirSync(dirPath)
      expect(existsSync(dirPath)).toBe(true)
      ensureDir(dirPath)
      expect(existsSync(dirPath)).toBe(true)
    })
  })

  describe('writeFileContent', () => {
    it('writes string content to file', () => {
      const filePath = join(TEST_DIR, 'test.txt')
      writeFileContent(filePath, 'Hello, World!')
      const content = readFileSync(filePath, 'utf-8')
      expect(content).toBe('Hello, World!')
    })

    it('creates parent directories', () => {
      const filePath = join(TEST_DIR, 'nested', 'dir', 'test.txt')
      expect(existsSync(join(TEST_DIR, 'nested'))).toBe(false)
      writeFileContent(filePath, 'Hello!')
      expect(existsSync(filePath)).toBe(true)
      expect(readFileSync(filePath, 'utf-8')).toBe('Hello!')
    })

    it('overwrites existing file', () => {
      const filePath = join(TEST_DIR, 'overwrite.txt')
      writeFileContent(filePath, 'First')
      writeFileContent(filePath, 'Second')
      expect(readFileSync(filePath, 'utf-8')).toBe('Second')
    })

    it('writes with custom encoding', () => {
      const filePath = join(TEST_DIR, 'encoded.txt')
      writeFileContent(filePath, 'Test content', { encoding: 'utf-8' })
      expect(readFileSync(filePath, 'utf-8')).toBe('Test content')
    })

    it('throws error when write fails', () => {
      const dirPath = join(TEST_DIR, 'conflicting-dir')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeFileContent(filePath, 'content')).toThrow()
    })
  })

  describe('writeFileBuffer', () => {
    it('writes buffer to file', () => {
      const filePath = join(TEST_DIR, 'buffer.bin')
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      writeFileBuffer(filePath, buffer)
      const content = readFileSync(filePath)
      expect(content).toEqual(buffer)
    })

    it('creates parent directories', () => {
      const filePath = join(TEST_DIR, 'nested', 'buffer.bin')
      const buffer = Buffer.from('test')
      writeFileBuffer(filePath, buffer)
      expect(existsSync(filePath)).toBe(true)
    })

    it('throws error when buffer write fails', () => {
      const dirPath = join(TEST_DIR, 'buffer-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeFileBuffer(filePath, Buffer.from('test'))).toThrow()
    })
  })

  describe('writeJsonFile', () => {
    it('writes formatted JSON', () => {
      const filePath = join(TEST_DIR, 'config.json')
      const data = { name: 'test', version: '1.0.0' }
      writeJsonFile(filePath, data)
      const content = readFileSync(filePath, 'utf-8')
      expect(JSON.parse(content)).toEqual(data)
      expect(content).toContain('\n')
    })

    it('respects indent option', () => {
      const filePath = join(TEST_DIR, 'indent.json')
      writeJsonFile(filePath, { a: 1 }, { indent: 4 })
      const content = readFileSync(filePath, 'utf-8')
      expect(content).toBe('{\n    "a": 1\n}\n')
    })

    it('creates parent directories', () => {
      const filePath = join(TEST_DIR, 'nested', 'config.json')
      writeJsonFile(filePath, { value: true })
      expect(existsSync(filePath)).toBe(true)
    })

    it('throws error when JSON write fails', () => {
      const dirPath = join(TEST_DIR, 'json-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeJsonFile(filePath, { test: true })).toThrow()
    })

    it('handles circular reference error from stringify', () => {
      const filePath = join(TEST_DIR, 'circular.json')
      const circular: Record<string, unknown> = { name: 'test' }
      circular['self'] = circular

      expect(() => writeJsonFile(filePath, circular)).toThrow()
    })

    it('re-throws FS_WRITE_ERROR without wrapping', () => {
      const dirPath = join(TEST_DIR, 'rethrow-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeJsonFile(filePath, { test: true })).toThrow()
    })
  })
})
