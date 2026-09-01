import { sep } from 'node:path'
import { describe, it, expect } from '@hyperfrontend/testing'
import { join, joinPosix } from './join'

describe('core/path/join', () => {
  describe('join', () => {
    it('joins path segments', () => {
      const result = join('a', 'b', 'c')
      expect(result).toBe(`a${sep}b${sep}c`)
    })

    it('handles single segment', () => {
      expect(join('a')).toBe('a')
    })

    it('handles empty segments', () => {
      expect(join('a', '', 'b')).toBe(`a${sep}b`)
    })

    it('normalizes slashes', () => {
      const result = join('a/b', 'c')
      expect(result).toContain('c')
    })

    it('handles absolute paths', () => {
      const result = join('/root', 'sub', 'file.txt')
      expect(result).toContain('file.txt')
    })
  })

  describe('joinPosix', () => {
    it('always uses forward slashes', () => {
      const result = joinPosix('a', 'b', 'c')
      expect(result).toBe('a/b/c')
    })

    it('handles single segment', () => {
      expect(joinPosix('a')).toBe('a')
    })

    it('normalizes paths', () => {
      expect(joinPosix('a//b', 'c')).toBe('a/b/c')
    })

    it('handles absolute paths', () => {
      expect(joinPosix('/root', 'sub')).toBe('/root/sub')
    })

    it('does not use backslashes on any platform', () => {
      const result = joinPosix('a', 'b', 'c')
      expect(result).not.toContain('\\')
      expect(result).toBe('a/b/c')
    })
  })
})
