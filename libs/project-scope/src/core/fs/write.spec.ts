import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { writeFileContent, writeFileBuffer, writeJsonFile, ensureDir } from './write'

describe('core/fs/write', () => {
  const tempDir = useTempDir({ prefix: 'write-test-' })

  describe('ensureDir', () => {
    it('creates directory if not exists', () => {
      const dirPath = join(tempDir.path, 'new-dir')
      const existedBefore = existsSync(dirPath)
      ensureDir(dirPath)
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: false, after: true })
    })

    it('creates nested directories', () => {
      const dirPath = join(tempDir.path, 'a', 'b', 'c')
      const existedBefore = existsSync(dirPath)
      ensureDir(dirPath)
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: false, after: true })
    })

    it('does nothing if directory exists', () => {
      const dirPath = join(tempDir.path, 'existing-dir')
      mkdirSync(dirPath)
      const existedBefore = existsSync(dirPath)
      ensureDir(dirPath)
      expect({ before: existedBefore, after: existsSync(dirPath) }).toEqual({ before: true, after: true })
    })
  })

  describe('writeFileContent', () => {
    it('writes string content to file', () => {
      const filePath = join(tempDir.path, 'test.txt')
      writeFileContent(filePath, 'Hello, World!')
      const content = readFileSync(filePath, 'utf-8')
      expect(content).toBe('Hello, World!')
    })

    it('creates parent directories', () => {
      const filePath = join(tempDir.path, 'nested', 'dir', 'test.txt')
      const parentExistedBefore = existsSync(join(tempDir.path, 'nested'))
      writeFileContent(filePath, 'Hello!')
      expect({ parentExistedBefore, content: readFileSync(filePath, 'utf-8') }).toEqual({ parentExistedBefore: false, content: 'Hello!' })
    })

    it('overwrites existing file', () => {
      const filePath = join(tempDir.path, 'overwrite.txt')
      writeFileContent(filePath, 'First')
      writeFileContent(filePath, 'Second')
      expect(readFileSync(filePath, 'utf-8')).toBe('Second')
    })

    it('writes with custom encoding', () => {
      const filePath = join(tempDir.path, 'encoded.txt')
      writeFileContent(filePath, 'Test content', { encoding: 'utf-8' })
      expect(readFileSync(filePath, 'utf-8')).toBe('Test content')
    })

    it('throws error when write fails', () => {
      const dirPath = join(tempDir.path, 'conflicting-dir')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeFileContent(filePath, 'content')).toThrow()
    })
  })

  describe('writeFileBuffer', () => {
    it('writes buffer to file', () => {
      const filePath = join(tempDir.path, 'buffer.bin')
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      writeFileBuffer(filePath, buffer)
      const content = readFileSync(filePath)
      expect(content).toEqual(buffer)
    })

    it('creates parent directories', () => {
      const filePath = join(tempDir.path, 'nested', 'buffer.bin')
      const buffer = Buffer.from('test')
      writeFileBuffer(filePath, buffer)
      expect(existsSync(filePath)).toBe(true)
    })

    it('throws error when buffer write fails', () => {
      const dirPath = join(tempDir.path, 'buffer-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeFileBuffer(filePath, Buffer.from('test'))).toThrow()
    })
  })

  describe('writeJsonFile', () => {
    it('writes formatted JSON', () => {
      const filePath = join(tempDir.path, 'config.json')
      writeJsonFile(filePath, { name: 'test', version: '1.0.0' })
      expect(readFileSync(filePath, 'utf-8')).toBe('{\n  "name": "test",\n  "version": "1.0.0"\n}\n')
    })

    it('respects indent option', () => {
      const filePath = join(tempDir.path, 'indent.json')
      writeJsonFile(filePath, { a: 1 }, { indent: 4 })
      const content = readFileSync(filePath, 'utf-8')
      expect(content).toBe('{\n    "a": 1\n}\n')
    })

    it('creates parent directories', () => {
      const filePath = join(tempDir.path, 'nested', 'config.json')
      writeJsonFile(filePath, { value: true })
      expect(existsSync(filePath)).toBe(true)
    })

    it('throws error when JSON write fails', () => {
      const dirPath = join(tempDir.path, 'json-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeJsonFile(filePath, { test: true })).toThrow()
    })

    it('handles circular reference error from stringify', () => {
      const filePath = join(tempDir.path, 'circular.json')
      const circular: Record<string, unknown> = { name: 'test' }
      circular['self'] = circular

      expect(() => writeJsonFile(filePath, circular)).toThrow()
    })

    it('re-throws FS_WRITE_ERROR without wrapping', () => {
      const dirPath = join(tempDir.path, 'rethrow-conflict')
      mkdirSync(dirPath)
      const filePath = join(dirPath, '.', '.')

      expect(() => writeJsonFile(filePath, { test: true })).toThrow()
    })
  })
})
