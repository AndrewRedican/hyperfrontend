import type { FileChange, FileDiff } from './types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { generateDiff, formatUnifiedDiff, generateAllDiffs } from './diff'
import { createFsTree } from './fs-tree'

describe('vfs/diff', () => {
  describe('generateDiff', () => {
    describe('new file creation', () => {
      it('generates diff for new file', () => {
        const change: FileChange = {
          path: 'new.txt',
          type: 'CREATE',
          content: Buffer.from('line1\nline2\n'),
        }
        expect(generateDiff(change)).toEqual({
          path: 'new.txt',
          lines: [
            { type: 'add', line: 1, content: 'line1' },
            { type: 'add', line: 2, content: 'line2' },
          ],
          additions: 2,
          deletions: 0,
        })
      })

      it('generates diff for empty new file', () => {
        const change: FileChange = {
          path: 'empty.txt',
          type: 'CREATE',
          content: Buffer.from(''),
        }
        expect(generateDiff(change)).toEqual(expect.objectContaining({ additions: 1, deletions: 0 }))
      })

      it('generates diff for single line new file', () => {
        const change: FileChange = {
          path: 'single.txt',
          type: 'CREATE',
          content: Buffer.from('single line'),
        }
        expect(generateDiff(change)).toEqual({
          path: 'single.txt',
          lines: [{ type: 'add', line: 1, content: 'single line' }],
          additions: 1,
          deletions: 0,
        })
      })
    })

    describe('file deletion', () => {
      it('generates diff for deleted file', () => {
        const change: FileChange = {
          path: 'deleted.txt',
          type: 'DELETE',
          originalContent: Buffer.from('old content\n'),
        }
        expect(generateDiff(change)).toEqual({
          path: 'deleted.txt',
          lines: [{ type: 'remove', line: 1, content: 'old content' }],
          additions: 0,
          deletions: 1,
        })
      })

      it('generates diff for multi-line deleted file', () => {
        const change: FileChange = {
          path: 'deleted.txt',
          type: 'DELETE',
          originalContent: Buffer.from('line1\nline2\nline3\n'),
        }
        expect(generateDiff(change)).toEqual(expect.objectContaining({ deletions: 3, additions: 0 }))
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
        expect(generateDiff(change)).toEqual(
          expect.objectContaining({
            additions: 1,
            deletions: 1,
            lines: expect.arrayContaining([expect.objectContaining({ type: 'context' })]),
          })
        )
      })

      it('generates diff for file with multiple changes', () => {
        const change: FileChange = {
          path: 'multi.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('a\nb\nc\nd\ne\n'),
          content: Buffer.from('a\nB\nc\nD\ne\n'),
        }
        expect(generateDiff(change)).toEqual(expect.objectContaining({ additions: 2, deletions: 2 }))
      })

      it('handles added lines', () => {
        const change: FileChange = {
          path: 'added.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('line1\nline3\n'),
          content: Buffer.from('line1\nline2\nline3\n'),
        }
        expect(generateDiff(change)).toEqual(expect.objectContaining({ additions: 1, deletions: 0 }))
      })

      it('handles removed lines', () => {
        const change: FileChange = {
          path: 'removed.txt',
          type: 'UPDATE',
          originalContent: Buffer.from('line1\nline2\nline3\n'),
          content: Buffer.from('line1\nline3\n'),
        }
        expect(generateDiff(change)).toEqual(expect.objectContaining({ additions: 0, deletions: 1 }))
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
      expect(formatUnifiedDiff(fileDiff)).toBe('--- a/test.txt\n+++ b/test.txt\n@@ -1,2 +1,2 @@\n unchanged\n-old\n+new')
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
      expect(formatUnifiedDiff(fileDiff)).toBe('--- a/empty.txt\n+++ b/empty.txt')
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
      const contentLines = formatUnifiedDiff(fileDiff).split(/\r?\n/).slice(3)

      expect(contentLines).toEqual([' context line', '-removed line', '+added line'])
    })
  })

  describe('generateAllDiffs', () => {
    const tempDir = useTempDir({ prefix: 'diff-test-' })

    beforeEach(() => {
      writeFileSync(join(tempDir.path, 'existing.txt'), 'original content\n')
    })

    it('generates diffs for all changes in tree', () => {
      const tree = createFsTree(tempDir.path)
      tree.write('new.txt', 'new file content')
      tree.write('existing.txt', 'modified content')

      expect(
        generateAllDiffs(tree)
          .map((d) => d.path)
          .sort()
      ).toEqual(['existing.txt', 'new.txt'])
    })

    it('returns empty array for tree with no changes', () => {
      const tree = createFsTree(tempDir.path)
      const diffs = generateAllDiffs(tree)
      expect(diffs).toEqual([])
    })

    it.each([5, 0])('generates one diff per change with %s context lines', (contextLines) => {
      const tree = createFsTree(tempDir.path)
      tree.write('new.txt', '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')

      expect(generateAllDiffs(tree, { contextLines })).toHaveLength(1)
    })
  })

  describe('integration', () => {
    const tempDir = useTempDir({ prefix: 'diff-test-' })

    beforeEach(() => {
      mkdirSync(join(tempDir.path, 'src'), { recursive: true })
      writeFileSync(join(tempDir.path, 'src', 'index.ts'), 'export const x = 1;\n')
    })

    it('generates and formats complete diff workflow', () => {
      const tree = createFsTree(tempDir.path)
      tree.write('src/index.ts', 'export const x = 2;\nexport const y = 3;\n')
      tree.write('README.md', '# Project\n')
      tree.delete('src/index.ts')

      const headers = generateAllDiffs(tree).map((diff) => formatUnifiedDiff(diff).split(/\r?\n/).slice(0, 2))
      expect(headers).toEqual([
        ['--- a/README.md', '+++ b/README.md'],
        ['--- a/src/index.ts', '+++ b/src/index.ts'],
      ])
    })
  })

  describe('edge cases for branch coverage', () => {
    function spreadChange(): FileChange {
      const originalLines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
      const newLines = [...originalLines]
      newLines[0] = 'CHANGED_LINE_1'
      newLines[19] = 'CHANGED_LINE_20'

      return {
        path: 'spread.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n') + '\n'),
        content: Buffer.from(newLines.join('\n') + '\n'),
      }
    }

    function sameChange(): FileChange {
      const originalLines: string[] = []
      const newLines: string[] = []

      for (let i = 0; i < 30; i++) {
        originalLines.push(`unchanged_${i}`)
        newLines.push(`unchanged_${i}`)
      }

      newLines[0] = 'MODIFIED_START'
      newLines[29] = 'MODIFIED_END'

      return {
        path: 'skip-same.txt',
        type: 'UPDATE',
        originalContent: Buffer.from(originalLines.join('\n')),
        content: Buffer.from(newLines.join('\n')),
      }
    }

    it('counts the changes spread far apart in an UPDATE diff', () => {
      expect(generateDiff(spreadChange(), { contextLines: 2 })).toEqual(expect.objectContaining({ additions: 2, deletions: 2 }))
    })

    it('skips the context lines between changes spread far apart', () => {
      expect(generateDiff(spreadChange(), { contextLines: 2 }).lines.length).toBeLessThan(20)
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

      expect(generateDiff(change, { contextLines: 1 })).toEqual(expect.objectContaining({ additions: 2, deletions: 0 }))
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

      expect(generateDiff(change, { contextLines: 1 })).toEqual(expect.objectContaining({ deletions: 2, additions: 0 }))
    })

    it('reports the modified ends with surrounding context when same operations are skipped', () => {
      expect(generateDiff(sameChange(), { contextLines: 2 })).toEqual(
        expect.objectContaining({
          additions: 2,
          deletions: 2,
          lines: expect.arrayContaining([expect.objectContaining({ type: 'context' })]),
        })
      )
    })

    it('omits the unchanged lines outside the context window', () => {
      expect(generateDiff(sameChange(), { contextLines: 2 }).lines.length).toBeLessThan(30)
    })
  })
})
