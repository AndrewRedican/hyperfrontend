import { describe, expect, it } from '@hyperfrontend/testing'
import { pathSegments, getBasename, getDirname, getExtension, getFileNameWithoutExtension, parsePath } from './segments'

describe('core/path/segments', () => {
  describe('pathSegments', () => {
    it('splits path into segments', () => {
      expect(pathSegments('a/b/c')).toEqual(['a', 'b', 'c'])
    })

    it('handles leading slash', () => {
      expect(pathSegments('/a/b/c')).toEqual(['a', 'b', 'c'])
    })

    it('filters empty segments', () => {
      expect(pathSegments('a//b//c')).toEqual(['a', 'b', 'c'])
    })
  })

  describe('getBasename', () => {
    it('returns basename', () => {
      expect(getBasename('/a/b/file.ts')).toBe('file.ts')
    })

    it('strips extension when provided', () => {
      expect(getBasename('/a/b/file.ts', '.ts')).toBe('file')
    })
  })

  describe('getDirname', () => {
    it('returns directory name', () => {
      expect(getDirname('/a/b/file.ts')).toBe('/a/b')
    })
  })

  describe('getExtension', () => {
    it('returns file extension', () => {
      expect(getExtension('file.ts')).toBe('.ts')
    })

    it('returns empty string for no extension', () => {
      expect(getExtension('file')).toBe('')
    })
  })

  describe('getFileNameWithoutExtension', () => {
    it('returns filename without extension', () => {
      expect(getFileNameWithoutExtension('/path/to/file.ts')).toBe('file')
    })

    it('handles multiple dots', () => {
      expect(getFileNameWithoutExtension('file.test.ts')).toBe('file.test')
    })

    it('handles no extension', () => {
      expect(getFileNameWithoutExtension('Makefile')).toBe('Makefile')
    })
  })

  describe('parsePath', () => {
    it('parses path into components', () => {
      const result = parsePath('/root/dir/file.ts')
      expect(result.root).toBe('/')
      expect(result.dir).toBe('/root/dir')
      expect(result.base).toBe('file.ts')
      expect(result.name).toBe('file')
      expect(result.ext).toBe('.ts')
    })
  })
})
