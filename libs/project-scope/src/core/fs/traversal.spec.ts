import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { traverseUpward, locateByMarkers, findUpwardWhere } from './traversal'

describe('core/fs/traversal', () => {
  let tempDir: string
  let deepDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'traversal-test-'))
    // Create deep directory structure: tempDir/level1/level2/level3
    const level1 = join(tempDir, 'level1')
    const level2 = join(level1, 'level2')
    deepDir = join(level2, 'level3')
    mkdirSync(level1)
    mkdirSync(level2)
    mkdirSync(deepDir)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('traverseUpward', () => {
    it('finds directory matching predicate', () => {
      // Place a marker file in level1
      const markerPath = join(tempDir, 'level1', 'marker.txt')
      writeFileSync(markerPath, '')

      const result = traverseUpward(deepDir, (dir) => {
        try {
          const fs = require('node:fs')
          return fs.existsSync(join(dir, 'marker.txt'))
        } catch {
          return false
        }
      })

      expect(result).toBe(join(tempDir, 'level1'))
    })

    it('returns null when no directory matches', () => {
      const result = traverseUpward(deepDir, () => false)
      expect(result).toBeNull()
    })

    it('checks root directory', () => {
      const result = traverseUpward(tempDir, (dir) => dir.includes('tmp') || dir.includes('temp'))
      expect(result).toBeTruthy()
    })

    it('stops at first match', () => {
      // Place markers in multiple levels
      writeFileSync(join(tempDir, 'level1', 'marker.txt'), '')
      writeFileSync(join(tempDir, 'marker.txt'), '')

      const result = traverseUpward(deepDir, (dir) => {
        try {
          const fs = require('node:fs')
          return fs.existsSync(join(dir, 'marker.txt'))
        } catch {
          return false
        }
      })

      // Should find level1 first (closest to start)
      expect(result).toBe(join(tempDir, 'level1'))
    })
  })

  describe('locateByMarkers', () => {
    it('finds directory with marker file', () => {
      const markerPath = join(tempDir, 'level1', 'package.json')
      writeFileSync(markerPath, '{}')

      const result = locateByMarkers(deepDir, ['package.json'])
      expect(result).toBe(join(tempDir, 'level1'))
    })

    it('finds directory with any of multiple markers', () => {
      const markerPath = join(tempDir, 'level1', '.git')
      writeFileSync(markerPath, '')

      const result = locateByMarkers(deepDir, ['package.json', '.git', 'pnpm-workspace.yaml'])
      expect(result).toBe(join(tempDir, 'level1'))
    })

    it('returns null when no markers found', () => {
      const result = locateByMarkers(deepDir, ['nonexistent.file'])
      expect(result).toBeNull()
    })

    it('handles empty markers array', () => {
      const result = locateByMarkers(deepDir, [])
      expect(result).toBeNull()
    })
  })

  describe('findUpwardWhere', () => {
    it('finds directory matching test', () => {
      writeFileSync(join(tempDir, 'level1', 'test.txt'), '')

      const result = findUpwardWhere(deepDir, (dir) => {
        try {
          const fs = require('node:fs')
          return fs.existsSync(join(dir, 'test.txt'))
        } catch {
          return false
        }
      })

      expect(result).toBe(join(tempDir, 'level1'))
    })

    it('returns null when test never passes', () => {
      const result = findUpwardWhere(deepDir, () => false)
      expect(result).toBeNull()
    })

    it('works with custom test logic', () => {
      // Find directory whose basename is 'level1'
      const result = findUpwardWhere(deepDir, (dir) => {
        const parts = dir.split('/')
        const basename = parts[parts.length - 1]
        return basename === 'level1'
      })
      expect(result).toBe(join(tempDir, 'level1'))
    })
  })

  describe('traverseUpward - root directory edge case', () => {
    it('checks root directory when no other match found', () => {
      // Use a predicate that only returns true for root path
      const { root } = require('node:path').parse(deepDir)

      const result = traverseUpward(deepDir, (dir) => dir === root)
      expect(result).toBe(root)
    })
  })
})
