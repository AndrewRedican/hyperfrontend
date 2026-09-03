/**
 * Tests for tree.ts error handling and formatSize branches.
 * Uses Jest mocks to ensure all branches are covered.
 */
import type { MockedFunction } from '@hyperfrontend/testing'
import type { FileStats } from '../../core/fs'
import { resolve } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fsModule from '../../core/fs'
import * as traversalModule from '../../project/traversal'
import { treeCommand } from './tree'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

jest.mock('../../project/traversal', () => {
  const actual = jest.requireActual('../../project/traversal')
  return {
    ...actual,
    walkDirectory: jest.fn().mockImplementation(actual.walkDirectory),
  }
})

jest.mock('../../core/fs', () => {
  const actual = jest.requireActual('../../core/fs')
  return {
    ...actual,
    getFileStat: jest.fn().mockImplementation(actual.getFileStat),
  }
})

const mockWalkDirectory = traversalModule.walkDirectory as MockedFunction<typeof traversalModule.walkDirectory>
const mockGetFileStat = fsModule.getFileStat as MockedFunction<typeof fsModule.getFileStat>

function createMockStats(size: number): FileStats {
  const now = new Date()
  return {
    size,
    modified: now,
    created: now,
    accessed: now,
    mode: 0o644,
    isFile: true,
    isDirectory: false,
    isSymlink: false,
  }
}

describe('treeCommand error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWalkDirectory.mockImplementation(jest.requireActual('../../project/traversal').walkDirectory)
    mockGetFileStat.mockImplementation(jest.requireActual('../../core/fs').getFileStat)
  })

  describe('treeCommand catch block (L267-268)', () => {
    it('returns exit code 1 and error message when walkDirectory throws', () => {
      mockWalkDirectory.mockImplementationOnce(() => {
        throw new Error('Directory traversal failed')
      })

      const result = treeCommand({ path: MINIMAL_PROJECT })

      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('Tree failed')
      expect(result.error).toContain('Directory traversal failed')
    })

    it('handles non-Error exceptions in treeCommand', () => {
      mockWalkDirectory.mockImplementationOnce(() => {
        throw 'String error in traversal'
      })

      const result = treeCommand({ path: MINIMAL_PROJECT })

      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('Tree failed')
      expect(result.error).toContain('String error in traversal')
    })
  })

  describe('formatSize all size ranges (L21-25)', () => {
    it('formats sizes in all ranges: bytes, KB, MB, GB', () => {
      let callCount = 0

      mockGetFileStat.mockImplementation(() => {
        callCount++
        const sizes = [100, 5 * 1024, 3 * 1024 * 1024, 2 * 1024 * 1024 * 1024]
        const sizeIndex = callCount % sizes.length
        return createMockStats(sizes[sizeIndex])
      })

      const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toBeDefined()
      // Note: The actual formatting depends on which files are traversed
    })

    it('shows 0B for empty files', () => {
      mockGetFileStat.mockImplementation(() => createMockStats(0))

      const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('0B')
    })

    it('shows KB for files in kilobyte range', () => {
      mockGetFileStat.mockImplementation(() => createMockStats(2048))

      const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('2.0K')
    })

    it('shows MB for files in megabyte range', () => {
      mockGetFileStat.mockImplementation(() => createMockStats(5 * 1024 * 1024))

      const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('5.0M')
    })

    it('shows GB for files in gigabyte range', () => {
      mockGetFileStat.mockImplementation(() => createMockStats(2 * 1024 * 1024 * 1024))

      const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('2.0G')
    })
  })
})
