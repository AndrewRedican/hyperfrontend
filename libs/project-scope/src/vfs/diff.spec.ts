import type { FileChange, FileDiff } from './types'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { generateDiff, formatUnifiedDiff, generateAllDiffs } from './diff'
import { createFsTree } from './fs-tree'

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_diff__')

describe('vfs/diff', () => {
  describe('generateDiff', () => {
    describe('new file creation', () => {
      it('generates diff for new file', () => {
        const change: FileChange = {
          path: 'new.txt',
          type: 'CREATE',
          content: Buffer.from('line1\nline2\n'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(2)
        expect(diff.deletions).toBe(0)
        expect(diff.lines.every((l) => l.type === 'add')).toBe(true)
      })

      it('generates diff for empty new file', () => {
        const change: FileChange = {
          path: 'empty.txt',
          type: 'CREATE',
          content: Buffer.from(''),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(1)
        expect(diff.deletions).toBe(0)
      })

      it('generates diff for single line new file', () => {
        const change: FileChange = {
          path: 'single.txt',
          type: 'CREATE',
          content: Buffer.from('single line'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(1)
        expect(diff.deletions).toBe(0)
        expect(diff.lines[0].content).toBe('single line')
      })
    })

    describe('file deletion', () => {
      it('generates diff for deleted file', () => {
        const change: FileChange = {
          path: 'deleted.txt',
          type: 'DELETE',
          originalContent: Buffer.from('old content\n'),
        }
        const diff = generateDiff(change)
        expect(diff.deletions).toBe(1)
        expect(diff.additions).toBe(0)
        expect(diff.lines.every((l) => l.type === 'remove')).toBe(true)
      })

      it('generates diff for multi-line deleted file', () => {
        const change: FileChange = {
          path: 'deleted.txt',
          type: 'DELETE',
          originalContent: Buffer.from('line1\nline2\nline3\n'),
        }
        const diff = generateDiff(change)
        expect(diff.deletions).toBe(3)
        expect(diff.additions).toBe(0)
      })
    })

    describe('file modification', () => {
      it('generates diff for modified file with context', () => {
        const change: FileChange = {
          path: 'modified.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('line1\nline2\nline3\n'),
          content: Buffer.from('line1\nmodified\nline3\n'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(1)
        expect(diff.deletions).toBe(1)
        expect(diff.lines.filter((l) => l.type === 'context').length).toBeGreaterThan(0)
      })

      it('generates diff for file with multiple changes', () => {
        const change: FileChange = {
          path: 'multi.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('a\nb\nc\nd\ne\n'),
          content: Buffer.from('a\nB\nc\nD\ne\n'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(2)
        expect(diff.deletions).toBe(2)
      })

      it('handles added lines', () => {
        const change: FileChange = {
          path: 'added.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('line1\nline3\n'),
          content: Buffer.from('line1\nline2\nline3\n'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(1)
        expect(diff.deletions).toBe(0)
      })

      it('handles removed lines', () => {
        const change: FileChange = {
          path: 'removed.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('line1\nline2\nline3\n'),
          content: Buffer.from('line1\nline3\n'),
        }
        const diff = generateDiff(change)
        expect(diff.additions).toBe(0)
        expect(diff.deletions).toBe(1)
      })

      it('respects contextLines option', () => {
        const change: FileChange = {
          path: 'context.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n'),
          content: Buffer.from('1\n2\n3\n4\nFIVE\n6\n7\n8\n9\n10\n'),
        }

        const diffDefault = generateDiff(change)
        const diffMinimal = generateDiff(change, { contextLines: 1 })

        const contextDefault = diffDefault.lines.filter((l) => l.type === 'context').length
        const contextMinimal = diffMinimal.lines.filter((l) => l.type === 'context').length

        expect(contextDefault).toBeGreaterThanOrEqual(contextMinimal)
      })
    })
  })

  describe('formatUnifiedDiff', () => {
    it('formats as unified diff string', () => {
      const fileDiff: FileDiff = {
        path: 'test.txt',
        lines: [
          { type: 'context', line: 1, content: 'unchanged' },
          { type: 'remove', line: 2, content: 'old' },
          { type: 'add', line: 2, content: 'new' },
        ],
        additions: 1,
        deletions: 1,
      }
      const formatted = formatUnifiedDiff(fileDiff)
      expect(formatted).toContain('--- a/test.txt')
      expect(formatted).toContain('+++ b/test.txt')
      expect(formatted).toContain('-old')
      expect(formatted).toContain('+new')
    })

    it('includes hunk headers', () => {
      const fileDiff: FileDiff = {
        path: 'src/app.ts',
        lines: [
          { type: 'context', line: 1, content: 'const x = 1;' },
          { type: 'remove', line: 2, content: 'const y = 2;' },
          { type: 'add', line: 2, content: 'const y = 3;' },
          { type: 'context', line: 3, content: 'const z = 4;' },
        ],
        additions: 1,
        deletions: 1,
      }
      const formatted = formatUnifiedDiff(fileDiff)
      expect(formatted).toMatch(/@@.*@@/)
    })

    it('handles empty diff', () => {
      const fileDiff: FileDiff = {
        path: 'empty.txt',
        lines: [],
        additions: 0,
        deletions: 0,
      }
      const formatted = formatUnifiedDiff(fileDiff)
      expect(formatted).toContain('--- a/empty.txt')
      expect(formatted).toContain('+++ b/empty.txt')
    })

    it('uses correct prefixes for line types', () => {
      const fileDiff: FileDiff = {
        path: 'prefix.txt',
        lines: [
          { type: 'context', line: 1, content: 'context line' },
          { type: 'remove', line: 2, content: 'removed line' },
          { type: 'add', line: 2, content: 'added line' },
        ],
        additions: 1,
        deletions: 1,
      }
      const formatted = formatUnifiedDiff(fileDiff)
      const lines = formatted.split('\n')

      const contentLines = lines.slice(3)
      expect(contentLines.some((l) => l.startsWith(' context line'))).toBe(true)
      expect(contentLines.some((l) => l.startsWith('-removed line'))).toBe(true)
      expect(contentLines.some((l) => l.startsWith('+added line'))).toBe(true)
    })
  })

  describe('generateAllDiffs', () => {
    beforeEach(() => {
      rmSync(TEST_DIR, { recursive: true, force: true })
      mkdirSync(TEST_DIR, { recursive: true })
      writeFileSync(join(TEST_DIR, 'existing.txt'), 'original content\n')
    })

    afterAll(() => {
      rmSync(TEST_DIR, { recursive: true, force: true })
    })

    it('generates diffs for all changes in tree', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', 'new file content')
      tree.write('existing.txt', 'modified content')

      const diffs = generateAllDiffs(tree)
      expect(diffs.length).toBe(2)
      expect(diffs.map((d) => d.path).sort()).toEqual(['existing.txt', 'new.txt'])
    })

    it('returns empty array for tree with no changes', () => {
      const tree = createFsTree(TEST_DIR)
      const diffs = generateAllDiffs(tree)
      expect(diffs).toEqual([])
    })

    it('passes options to generateDiff', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')

      const diffsWithContext = generateAllDiffs(tree, { contextLines: 5 })
      const diffsMinimal = generateAllDiffs(tree, { contextLines: 0 })

      expect(diffsWithContext.length).toBe(1)
      expect(diffsMinimal.length).toBe(1)
    })
  })

  describe('integration', () => {
    beforeEach(() => {
      rmSync(TEST_DIR, { recursive: true, force: true })
      mkdirSync(TEST_DIR, { recursive: true })
      mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
      writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const x = 1;\n')
    })

    afterAll(() => {
      rmSync(TEST_DIR, { recursive: true, force: true })
    })

    it('generates and formats complete diff workflow', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('src/index.ts', 'export const x = 2;\nexport const y = 3;\n')
      tree.write('README.md', '# Project\n')
      tree.delete('src/index.ts')

      const changes = tree.listChanges()
      expect(changes.length).toBeGreaterThan(0)

      const diffs = generateAllDiffs(tree)
      for (const diff of diffs) {
        const formatted = formatUnifiedDiff(diff)
        expect(typeof formatted).toBe('string')
        expect(formatted).toContain('---')
        expect(formatted).toContain('+++')
      }
    })
  })

  describe('edge cases for branch coverage', () => {
    it('handles UPDATE diff with changes spread far apart to skip context lines', () => {
      const originalLines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
      const newLines = [...originalLines]
      newLines[0] = 'CHANGED_LINE_1'
      newLines[19] = 'CHANGED_LINE_20'

      const change: FileChange = {
        path: 'spread.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n') + '\n'),
        content: Buffer.from(newLines.join('\n') + '\n'),
      }

      const diff = generateDiff(change, { contextLines: 2 })

      expect(diff.additions).toBe(2)
      expect(diff.deletions).toBe(2)

      const totalLines = diff.lines.length
      expect(totalLines).toBeLessThan(20)
    })

    it('handles skipped add operations outside context window', () => {
      const originalLines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
      const newLines = ['A', 'X', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'Y']

      const change: FileChange = {
        path: 'skip-add.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n')),
        content: Buffer.from(newLines.join('\n')),
      }

      const diff = generateDiff(change, { contextLines: 1 })

      expect(diff.additions).toBe(2)
      expect(diff.deletions).toBe(0)
    })

    it('handles skipped remove operations outside context window', () => {
      const originalLines = ['A', 'B', 'X', 'C', 'D', 'E', 'F', 'G', 'H', 'Y', 'I', 'J']
      const newLines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

      const change: FileChange = {
        path: 'skip-remove.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n')),
        content: Buffer.from(newLines.join('\n')),
      }

      const diff = generateDiff(change, { contextLines: 1 })

      expect(diff.deletions).toBe(2)
      expect(diff.additions).toBe(0)
    })

    it('handles skipped same operations outside context window', () => {
      const originalLines: string[] = []
      const newLines: string[] = []

      for (let i = 0; i < 30; i++) {
        originalLines.push(`unchanged_${i}`)
        newLines.push(`unchanged_${i}`)
      }

      newLines[0] = 'MODIFIED_START'
      newLines[29] = 'MODIFIED_END'

      const change: FileChange = {
        path: 'skip-same.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n')),
        content: Buffer.from(newLines.join('\n')),
      }

      const diff = generateDiff(change, { contextLines: 2 })

      expect(diff.lines.length).toBeLessThan(30)

      const contextLines = diff.lines.filter((l) => l.type === 'context')
      expect(contextLines.length).toBeGreaterThan(0)
      expect(diff.additions).toBe(2)
      expect(diff.deletions).toBe(2)
    })
  })
})
