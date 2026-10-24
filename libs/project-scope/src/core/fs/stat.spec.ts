import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { getFileStat, isFile, isDirectory, isSymlink, exists } from './stat'

describe('core/fs/stat', () => {
  const tempDir = useTempDir({ prefix: 'stat-test-', scope: 'all' })

  beforeAll(() => {
    mkdirSync(join(tempDir.path, 'subdir'))
    writeFileSync(join(tempDir.path, 'file.txt'), 'content')
    try {
      symlinkSync(join(tempDir.path, 'file.txt'), join(tempDir.path, 'link.txt'))
    } catch {
      // Symlinks may not be supported on all platforms
    }
  })

  describe('getFileStat', () => {
    it('returns stats for file', () => {
      const stats = getFileStat(join(tempDir.path, 'file.txt'))
      expect(stats).toEqual(expect.objectContaining({ isFile: true, isDirectory: false, size: 7, modified: expect.any(Date) }))
    })

    it('returns stats for directory', () => {
      const stats = getFileStat(join(tempDir.path, 'subdir'))
      expect(stats).toEqual(expect.objectContaining({ isFile: false, isDirectory: true }))
    })

    it('returns null for non-existent path', () => {
      const stats = getFileStat(join(tempDir.path, 'missing.txt'))
      expect(stats).toBeNull()
    })
  })

  describe('isFile', () => {
    it('returns true for file', () => {
      expect(isFile(join(tempDir.path, 'file.txt'))).toBe(true)
    })

    it('returns false for directory', () => {
      expect(isFile(join(tempDir.path, 'subdir'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isFile(join(tempDir.path, 'missing.txt'))).toBe(false)
    })
  })

  describe('isDirectory', () => {
    it('returns true for directory', () => {
      expect(isDirectory(join(tempDir.path, 'subdir'))).toBe(true)
    })

    it('returns false for file', () => {
      expect(isDirectory(join(tempDir.path, 'file.txt'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isDirectory(join(tempDir.path, 'missing'))).toBe(false)
    })
  })

  describe('isSymlink', () => {
    it('returns false for regular file', () => {
      expect(isSymlink(join(tempDir.path, 'file.txt'))).toBe(false)
    })

    it('returns false for directory', () => {
      expect(isSymlink(join(tempDir.path, 'subdir'))).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isSymlink(join(tempDir.path, 'missing'))).toBe(false)
    })
  })

  describe('getFileStat - followSymlinks option', () => {
    it('uses lstatSync when followSymlinks is false', () => {
      const stats = getFileStat(join(tempDir.path, 'file.txt'), false)
      expect(stats).toEqual(expect.objectContaining({ isFile: true }))
    })

    it('detects symlink as symlink when followSymlinks is false', () => {
      const stats = getFileStat(join(tempDir.path, 'link.txt'), false)
      const isSymlinkDetected = stats?.isSymlink === true
      const isNullOrSymlink = stats === null || isSymlinkDetected
      expect(isNullOrSymlink).toBe(true)
    })
  })

  describe('exists', () => {
    it('returns true for existing file', () => {
      expect(exists(join(tempDir.path, 'file.txt'))).toBe(true)
    })

    it('returns true for existing directory', () => {
      expect(exists(join(tempDir.path, 'subdir'))).toBe(true)
    })

    it('returns false for non-existent path', () => {
      expect(exists(join(tempDir.path, 'missing'))).toBe(false)
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
