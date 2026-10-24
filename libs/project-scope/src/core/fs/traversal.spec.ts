import { existsSync } from 'node:fs'
import { basename, join, parse } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { traverseUpward, locateByMarkers, findUpwardWhere } from './traversal'

describe('core/fs/traversal', () => {
  const tempDir = useTempDir({ prefix: 'traversal-test-' })
  let deepDir: string

  beforeEach(() => {
    deepDir = tempDir.mkdir('level1/level2/level3')
  })

  describe('traverseUpward', () => {
    it('finds directory matching predicate', () => {
      tempDir.write('level1/marker.txt', '')

      const result = traverseUpward(deepDir, (dir) => {
        try {
          return existsSync(join(dir, 'marker.txt'))
        } catch {
          return false
        }
      })

      expect(result).toBe(tempDir.resolve('level1'))
    })

    it('returns null when no directory matches', () => {
      const result = traverseUpward(deepDir, () => false)
      expect(result).toBeNull()
    })

    it('checks root directory', () => {
      // why: the temp root is spelled differently per platform (Temp on Windows), so the predicate recognises the fixture directory by its own name
      const result = traverseUpward(tempDir.path, (dir) => basename(dir).startsWith('traversal-test-'))
      expect(result).toBe(tempDir.path)
    })

    it('stops at first match', () => {
      tempDir.write('level1/marker.txt', '')
      tempDir.write('marker.txt', '')

      const result = traverseUpward(deepDir, (dir) => {
        try {
          return existsSync(join(dir, 'marker.txt'))
        } catch {
          return false
        }
      })

      expect(result).toBe(tempDir.resolve('level1'))
    })
  })

  describe('locateByMarkers', () => {
    it('finds directory with marker file', () => {
      tempDir.write('level1/package.json', '{}')

      const result = locateByMarkers(deepDir, ['package.json'])
      expect(result).toBe(tempDir.resolve('level1'))
    })

    it('finds directory with any of multiple markers', () => {
      tempDir.write('level1/.git', '')

      const result = locateByMarkers(deepDir, ['package.json', '.git', 'pnpm-workspace.yaml'])
      expect(result).toBe(tempDir.resolve('level1'))
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
      tempDir.write('level1/test.txt', '')

      const result = findUpwardWhere(deepDir, (dir) => {
        try {
          return existsSync(join(dir, 'test.txt'))
        } catch {
          return false
        }
      })

      expect(result).toBe(tempDir.resolve('level1'))
    })

    it('returns null when test never passes', () => {
      const result = findUpwardWhere(deepDir, () => false)
      expect(result).toBeNull()
    })

    it('works with custom test logic', () => {
      const result = findUpwardWhere(deepDir, (dir) => {
        return basename(dir) === 'level1'
      })
      expect(result).toBe(tempDir.resolve('level1'))
    })
  })

  describe('traverseUpward - root directory edge case', () => {
    it('checks root directory when no other match found', () => {
      const { root } = parse(deepDir)

      const result = traverseUpward(deepDir, (dir) => dir === root)
      expect(result).toBe(root)
    })
  })
})
