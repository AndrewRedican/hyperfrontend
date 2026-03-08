import type { DiffLine, FileChange, FileDiff, Tree } from './types'

import { from as arrayFrom } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createScopedLogger } from '../core/logger'

const diffLogger = createScopedLogger('project-scope:vfs:diff')

/**
 * Options for diff generation.
 */
export interface DiffOptions {
  /**
   * Number of context lines around changes.
   *
   * @default 3
   */
  contextLines?: number
}

const DEFAULT_CONTEXT_LINES = 3

/**
 * Compute the Longest Common Subsequence (LCS) table for two arrays of lines.
 * Uses dynamic programming for O(n*m) time complexity.
 *
 * @param oldLines - Lines from the original file version
 * @param newLines - Lines from the new file version
 * @returns Two-dimensional LCS table for backtracking
 */
function computeLcsTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length
  const n = newLines.length
  const table: number[][] = arrayFrom({ length: m + 1 }, () => Array<number>(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1
      } else {
        table[i][j] = max(table[i - 1][j], table[i][j - 1])
      }
    }
  }

  return table
}

/**
 * Backtrack through LCS table to produce diff operations.
 *
 * @param table - Two-dimensional LCS table from computeLcsTable
 * @param oldLines - Lines from the original file version
 * @param newLines - Lines from the new file version
 * @returns Array of diff operations (unfiltered, includes all lines)
 */
function backtrackLcs(
  table: number[][],
  oldLines: string[],
  newLines: string[]
): { type: 'same' | 'add' | 'remove'; oldIdx: number; newIdx: number; content: string }[] {
  const result: { type: 'same' | 'add' | 'remove'; oldIdx: number; newIdx: number; content: string }[] = []
  let i = oldLines.length
  let j = newLines.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', oldIdx: i - 1, newIdx: j - 1, content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.unshift({ type: 'add', oldIdx: i - 1, newIdx: j - 1, content: newLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'remove', oldIdx: i - 1, newIdx: -1, content: oldLines[i - 1] })
      i--
    }
  }

  return result
}

/**
 * Convert raw diff operations to DiffLine array with context filtering.
 *
 * @param operations - Raw diff operations
 * @param contextLines - Number of context lines to include
 * @returns Filtered DiffLine array
 */
function operationsToDiffLines(
  operations: { type: 'same' | 'add' | 'remove'; oldIdx: number; newIdx: number; content: string }[],
  contextLines: number
): DiffLine[] {
  // Mark which lines should be included (changes + context)
  const include = new Array<boolean>(operations.length).fill(false)

  // First pass: mark all changes
  for (let i = 0; i < operations.length; i++) {
    if (operations[i].type !== 'same') {
      // Mark this line and context around it
      for (let j = max(0, i - contextLines); j <= min(operations.length - 1, i + contextLines); j++) {
        include[j] = true
      }
    }
  }

  // Second pass: convert to DiffLine
  const lines: DiffLine[] = []
  let oldLineNum = 1
  let newLineNum = 1

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]

    if (include[i]) {
      if (op.type === 'same') {
        lines.push({ type: 'context', line: oldLineNum, content: op.content })
        oldLineNum++
        newLineNum++
      } else if (op.type === 'remove') {
        lines.push({ type: 'remove', line: oldLineNum, content: op.content })
        oldLineNum++
      } else {
        lines.push({ type: 'add', line: newLineNum, content: op.content })
        newLineNum++
      }
    } else {
      // Skip but update line numbers
      if (op.type === 'same') {
        oldLineNum++
        newLineNum++
      } else if (op.type === 'remove') {
        /* istanbul ignore next -- unreachable: remove operations always have include=true */
        oldLineNum++
      } else {
        /* istanbul ignore next -- unreachable: add operations always have include=true */
        newLineNum++
      }
    }
  }

  return lines
}

/**
 * Split buffer content into lines.
 *
 * @param content - File content as Buffer, or undefined for empty
 * @returns Array of string lines from the buffer
 */
function bufferToLines(content: Buffer | undefined): string[] {
  if (!content) return []
  const text = content.toString('utf-8')
  // Split by newline, keeping empty last line if present
  return text.split('\n')
}

/**
 * Generate a diff for a single file change.
 *
 * @example
 * ```typescript
 * const change: FileChange = {
 *   path: 'src/app.ts',
 *   type: 'UPDATE',
 *   originalContent: Buffer.from('const x = 1;\n'),
 *   content: Buffer.from('const x = 2;\n'),
 * }
 * const diff = generateDiff(change)
 * // { path: 'src/app.ts', additions: 1, deletions: 1, lines: [...] }
 * ```
 *
 * @param change - File change to diff
 * @param options - Configuration for diff generation including context lines
 * @returns FileDiff object
 */
export function generateDiff(change: FileChange, options: DiffOptions = {}): FileDiff {
  const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES
  diffLogger.debug('generateDiff', { path: change.path, type: change.type, contextLines })

  const oldLines = bufferToLines(change.originalContent)
  const newLines = bufferToLines(change.content)

  // Handle edge cases
  if (change.type === 'CREATE') {
    // All lines are additions
    const lines: DiffLine[] = newLines
      .filter((line) => line !== '' || newLines.indexOf(line) !== newLines.length - 1 || newLines.length === 1)
      .map(
        (content, idx): DiffLine => ({
          type: 'add',
          line: idx + 1,
          content,
        })
      )
    // Filter out empty trailing line from split
    const filteredLines = lines.filter((l, i) => !(i === lines.length - 1 && l.content === '' && lines.length > 1))
    return {
      path: change.path,
      lines: filteredLines,
      additions: filteredLines.length,
      deletions: 0,
    }
  }

  if (change.type === 'DELETE') {
    // All lines are deletions
    const lines: DiffLine[] = oldLines.map(
      (content, idx): DiffLine => ({
        type: 'remove',
        line: idx + 1,
        content,
      })
    )
    // Filter out empty trailing line from split
    const filteredLines = lines.filter((l, i) => !(i === lines.length - 1 && l.content === '' && lines.length > 1))
    return {
      path: change.path,
      lines: filteredLines,
      additions: 0,
      deletions: filteredLines.length,
    }
  }

  // UPDATE: compute actual diff
  const table = computeLcsTable(oldLines, newLines)
  const operations = backtrackLcs(table, oldLines, newLines)
  const lines = operationsToDiffLines(operations, contextLines)

  const additions = lines.filter((l) => l.type === 'add').length
  const deletions = lines.filter((l) => l.type === 'remove').length

  return {
    path: change.path,
    lines,
    additions,
    deletions,
  }
}

/**
 * Format a FileDiff as a unified diff string.
 *
 * @example
 * ```typescript
 * const formatted = formatUnifiedDiff(diff)
 * console.log(formatted)
 * // --- a/src/app.ts
 * // +++ b/src/app.ts
 * // @@ -1,3 +1,3 @@
 * //  const x = 1;
 * // -const y = 2;
 * // +const y = 3;
 * //  const z = 4;
 * ```
 *
 * @param diff - FileDiff to format
 * @returns Unified diff string
 */
export function formatUnifiedDiff(diff: FileDiff): string {
  const lines: string[] = []

  // Header
  lines.push(`--- a/${diff.path}`)
  lines.push(`+++ b/${diff.path}`)

  if (diff.lines.length === 0) {
    return lines.join('\n')
  }

  // Group lines into hunks
  const hunks: DiffLine[][] = []
  const currentHunk: DiffLine[] = []

  for (const line of diff.lines) {
    currentHunk.push(line)
  }

  if (currentHunk.length > 0) {
    hunks.push(currentHunk)
  }

  // Output hunks
  for (const hunk of hunks) {
    // Calculate hunk header
    const contextAndRemove = hunk.filter((l) => l.type === 'context' || l.type === 'remove')
    const contextAndAdd = hunk.filter((l) => l.type === 'context' || l.type === 'add')

    const oldStart = hunk.find((l) => l.type === 'context' || l.type === 'remove')?.line ?? 1
    const newStart = hunk.find((l) => l.type === 'context' || l.type === 'add')?.line ?? 1

    const oldCount = contextAndRemove.length
    const newCount = contextAndAdd.length

    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`)

    // Output lines
    for (const line of hunk) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
      lines.push(`${prefix}${line.content}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generate diffs for all changes in a tree.
 *
 * @example
 * ```typescript
 * const tree = createTree('/workspace')
 * tree.write('new.txt', 'hello')
 * tree.delete('old.txt')
 *
 * const diffs = generateAllDiffs(tree)
 * for (const diff of diffs) {
 *   console.log(formatUnifiedDiff(diff))
 * }
 * ```
 *
 * @param tree - Tree to generate diffs for
 * @param options - Diff options
 * @returns Array of FileDiff objects
 */
export function generateAllDiffs(tree: Tree, options: DiffOptions = {}): FileDiff[] {
  const changes = tree.listChanges()
  diffLogger.debug('generateAllDiffs', { changeCount: changes.length })
  return changes.map((change) => generateDiff(change, options))
}
