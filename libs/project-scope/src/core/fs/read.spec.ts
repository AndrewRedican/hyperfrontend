import type { MockedFunction } from '@hyperfrontend/testing'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { readFileContent, readFileBuffer, readFileIfExists, readJsonFile, readJsonFileIfExists } from './read'

// why: the module under test binds `readFileSync` when it links, so no property replacement on the namespace can reach it. Replacing the module is what makes the read failures reachable, and the replacement calls through until a test says otherwise.
jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs')
  return { ...actual, readFileSync: jest.fn(actual.readFileSync) }
})

const mockReadFileSync = readFileSync as MockedFunction<typeof readFileSync>

const TEST_DIR = join(import.meta.dirname, '__test_fixtures__')
// how: A NUL byte is the one universally-illegal path character the guard rejects.
const POISONED = `poisoned ${'\u0000'} .txt`

describe('core/fs/read', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(join(TEST_DIR, 'text.txt'), 'Hello, World!')
    writeFileSync(join(TEST_DIR, 'utf8.txt'), 'Привет, мир!')
    writeFileSync(join(TEST_DIR, 'config.json'), JSON.stringify({ name: 'test', version: '1.0.0' }))
    writeFileSync(join(TEST_DIR, 'invalid.json'), '{ invalid json }')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('readFileContent', () => {
    it('reads file content as string', () => {
      const content = readFileContent(join(TEST_DIR, 'text.txt'))
      expect(content).toBe('Hello, World!')
    })

    it('reads UTF-8 content correctly', () => {
      const content = readFileContent(join(TEST_DIR, 'utf8.txt'))
      expect(content).toBe('Привет, мир!')
    })

    it('throws for missing file', () => {
      expect(() => readFileContent(join(TEST_DIR, 'missing.txt'))).toThrow(/File not found/)
    })
  })

  describe('readFileBuffer', () => {
    it('reads file content as buffer', () => {
      const buffer = readFileBuffer(join(TEST_DIR, 'text.txt'))
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.toString()).toBe('Hello, World!')
    })

    it('throws for missing file', () => {
      expect(() => readFileBuffer(join(TEST_DIR, 'missing.txt'))).toThrow(/File not found/)
    })
  })

  describe('readFileIfExists', () => {
    it('reads file content if exists', () => {
      const content = readFileIfExists(join(TEST_DIR, 'text.txt'))
      expect(content).toBe('Hello, World!')
    })

    it('returns null for missing file', () => {
      const content = readFileIfExists(join(TEST_DIR, 'missing.txt'))
      expect(content).toBeNull()
    })
  })

  describe('readJsonFile', () => {
    it('reads and parses JSON file', () => {
      const data = readJsonFile<{ name: string; version: string }>(join(TEST_DIR, 'config.json'))
      expect(data).toEqual({ name: 'test', version: '1.0.0' })
    })

    it('throws for missing file without default', () => {
      expect(() => readJsonFile(join(TEST_DIR, 'missing.json'))).toThrow(/File not found/)
    })

    it('returns default for missing file', () => {
      const data = readJsonFile(join(TEST_DIR, 'missing.json'), { default: { fallback: true } })
      expect(data).toEqual({ fallback: true })
    })

    it('throws for invalid JSON', () => {
      expect(() => readJsonFile(join(TEST_DIR, 'invalid.json'))).toThrow(/Failed to parse JSON/)
    })
  })

  describe('readJsonFileIfExists', () => {
    it('reads and parses JSON file if exists', () => {
      const data = readJsonFileIfExists<{ name: string }>(join(TEST_DIR, 'config.json'))
      expect(data).toEqual({ name: 'test', version: '1.0.0' })
    })

    it('returns null for missing file', () => {
      const data = readJsonFileIfExists(join(TEST_DIR, 'missing.json'))
      expect(data).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      const data = readJsonFileIfExists(join(TEST_DIR, 'invalid.json'))
      expect(data).toBeNull()
    })
  })

  describe('error handling - read failures', () => {
    it('throws FS_READ_ERROR when readFileContent encounters I/O error', () => {
      const errorFile = join(TEST_DIR, 'error-test.txt')
      writeFileSync(errorFile, 'content')

      mockReadFileSync.mockImplementationOnce(() => {
        const error = new Error('EACCES: permission denied')
        ;(error as { code?: string }).code = 'EACCES'
        throw error
      })

      expect(() => readFileContent(errorFile)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Failed to read file'),
          code: 'FS_READ_ERROR',
        })
      )

      jest.restoreAllMocks()
    })

    it('throws FS_READ_ERROR when readFileBuffer encounters I/O error', () => {
      const errorFile = join(TEST_DIR, 'error-buffer.txt')
      writeFileSync(errorFile, 'content')

      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('I/O error')
      })

      expect(() => readFileBuffer(errorFile)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Failed to read file'),
          code: 'FS_READ_ERROR',
        })
      )

      jest.restoreAllMocks()
    })

    it('readFileIfExists returns null on read error after exists check', () => {
      const errorFile = join(TEST_DIR, 'if-exists-error.txt')
      writeFileSync(errorFile, 'content')

      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('Read error')
      })

      const result = readFileIfExists(errorFile)
      expect(result).toBeNull()

      jest.restoreAllMocks()
    })
  })

  describe('unsafe path rejection', () => {
    it('throws when readFileContent receives a NUL-poisoned path', () => {
      expect(() => readFileContent(POISONED)).toThrow(/Unsafe file path/)
    })

    it('throws when readFileBuffer receives a NUL-poisoned path', () => {
      expect(() => readFileBuffer(POISONED)).toThrow(/Unsafe file path/)
    })

    it('throws when readJsonFile receives a NUL-poisoned path even with a default', () => {
      expect(() => readJsonFile(POISONED, { default: {} })).toThrow(/Unsafe file path/)
    })

    it('returns null when readFileIfExists receives a NUL-poisoned path', () => {
      expect(readFileIfExists(POISONED)).toBeNull()
    })

    it('returns null when readJsonFileIfExists receives a NUL-poisoned path', () => {
      expect(readJsonFileIfExists(POISONED)).toBeNull()
    })
  })
})
