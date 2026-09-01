import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolvePath, resolveFromWorkspace, resolveRealPath, relativePath, joinPath, isAbsolute, offsetFromRoot } from './resolve'

const TEST_DIR = join(import.meta.dirname, '__test_resolve_fixtures__')

describe('core/path/resolve', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(join(TEST_DIR, 'file.txt'), 'content')
    try {
      symlinkSync(join(TEST_DIR, 'file.txt'), join(TEST_DIR, 'link.txt'))
    } catch {
      // Symlinks may not work on all platforms
    }
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('resolvePath', () => {
    it('resolves to absolute path', () => {
      const result = resolvePath('a', 'b', 'c')
      expect(result).toMatch(/^\//)
    })

    it('resolves with cwd', () => {
      const result = resolvePath('.')
      expect(result).toBe(process.cwd())
    })
  })

  describe('resolveFromWorkspace', () => {
    it('resolves relative to workspace root', () => {
      const result = resolveFromWorkspace('/workspace', 'src', 'index.ts')
      expect(result).toBe('/workspace/src/index.ts')
    })
  })

  describe('resolveRealPath', () => {
    it('returns real path for existing file', () => {
      const result = resolveRealPath(join(TEST_DIR, 'file.txt'))
      expect(result).not.toBeNull()
      expect(result).toContain('file.txt')
    })

    it('returns null for missing file', () => {
      const result = resolveRealPath(join(TEST_DIR, 'missing.txt'))
      expect(result).toBeNull()
    })
  })

  describe('relativePath', () => {
    it('returns relative path between two paths', () => {
      const result = relativePath('/a/b', '/a/c')
      expect(result).toBe('../c')
    })
  })

  describe('joinPath', () => {
    it('joins path segments', () => {
      expect(joinPath('a', 'b', 'c')).toBe('a/b/c')
    })
  })

  describe('isAbsolute', () => {
    it('returns true for absolute paths', () => {
      expect(isAbsolute('/absolute/path')).toBe(true)
    })

    it('returns false for relative paths', () => {
      expect(isAbsolute('relative/path')).toBe(false)
    })
  })

  describe('offsetFromRoot', () => {
    it('calculates offset for nested path', () => {
      expect(offsetFromRoot('a/b/c')).toBe('../../../')
    })

    it('calculates offset for single level', () => {
      expect(offsetFromRoot('a')).toBe('../')
    })

    it('handles empty path', () => {
      expect(offsetFromRoot('')).toBe('')
    })
  })
})
