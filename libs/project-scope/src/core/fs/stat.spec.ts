import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getFileStat, isFile, isDirectory, isSymlink, exists } from './stat'

const TEST_DIR = join(import.meta.dirname, '__test_stat_fixtures__')

describe('core/fs/stat', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'subdir'))
    writeFileSync(join(TEST_DIR, 'file.txt'), 'content')
    try {
      symlinkSync(join(TEST_DIR, 'file.txt'), join(TEST_DIR, 'link.txt'))
    } catch {
      // Symlinks may not be supported on all platforms
    }
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('getFileStat', () => {
    it('returns stats for file', () => {
      const stats = getFileStat(join(TEST_DIR, 'file.txt'))
      expect(stats).not.toBeNull()
      expect(stats?.isFile).toBe(true)
      expect(stats?.isDirectory).toBe(false)
      expect(stats?.size).toBeGreaterThan(0)
      expect(stats?.modified).toBeTruthy()
    })

    it('returns stats for directory', () => {
      const stats = getFileStat(join(TEST_DIR, 'subdir'))
      expect(stats).not.toBeNull()
      expect(stats?.isFile).toBe(false)
      expect(stats?.isDirectory).toBe(true)
    })

    it('returns null for non-existent path', () => {
      const stats = getFileStat(join(TEST_DIR, 'missing.txt'))
      expect(stats).toBeNull()
    })
  })

  describe('isFile', () => {
    it('returns true for file', () => {
      expect(isFile(join(TEST_DIR, 'file.txt'))).toBe(true)
    })

    it('returns false for directory', () => {
      expect(isFile(join(TEST_DIR, 'subdir'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isFile(join(TEST_DIR, 'missing.txt'))).toBe(false)
    })
  })

  describe('isDirectory', () => {
    it('returns true for directory', () => {
      expect(isDirectory(join(TEST_DIR, 'subdir'))).toBe(true)
    })

    it('returns false for file', () => {
      expect(isDirectory(join(TEST_DIR, 'file.txt'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isDirectory(join(TEST_DIR, 'missing'))).toBe(false)
    })
  })

  describe('isSymlink', () => {
    it('returns false for regular file', () => {
      expect(isSymlink(join(TEST_DIR, 'file.txt'))).toBe(false)
    })

    it('returns false for directory', () => {
      expect(isSymlink(join(TEST_DIR, 'subdir'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isSymlink(join(TEST_DIR, 'missing'))).toBe(false)
    })
  })

  describe('getFileStat - followSymlinks option', () => {
    it('uses lstatSync when followSymlinks is false', () => {
      const stats = getFileStat(join(TEST_DIR, 'file.txt'), false)
      expect(stats).not.toBeNull()
      expect(stats?.isFile).toBe(true)
    })

    it('detects symlink as symlink when followSymlinks is false', () => {
      const stats = getFileStat(join(TEST_DIR, 'link.txt'), false)
      const isSymlinkDetected = stats?.isSymlink === true
      const isNullOrSymlink = stats === null || isSymlinkDetected
      expect(isNullOrSymlink).toBe(true)
    })
  })

  describe('exists', () => {
    it('returns true for existing file', () => {
      expect(exists(join(TEST_DIR, 'file.txt'))).toBe(true)
    })

    it('returns true for existing directory', () => {
      expect(exists(join(TEST_DIR, 'subdir'))).toBe(true)
    })

    it('returns false for non-existent path', () => {
      expect(exists(join(TEST_DIR, 'missing'))).toBe(false)
    })
  })

  describe('unsafe path rejection', () => {
    // how: A NUL byte is the one universally-illegal path character the guard rejects.
    const POISONED = `poisoned ${'\u0000'} .txt`

    it('returns null from getFileStat for a NUL-poisoned path', () => {
      expect(getFileStat(POISONED)).toBeNull()
    })

    it('returns false from exists for a NUL-poisoned path', () => {
      expect(exists(POISONED)).toBe(false)
    })
  })
})
