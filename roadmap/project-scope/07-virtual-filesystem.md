# Virtual File System (VFS)

> **Document**: 07-virtual-filesystem.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Tree abstraction for file operations

---

## Overview

The Virtual File System (VFS), implemented as a `Tree` abstraction, is the core data structure enabling:

- **Transactional modifications**: Buffer changes before committing to disk
- **Dry-run operations**: Preview changes without writing
- **Consistent state**: All reads see writes from the same transaction
- **NX compatibility**: API aligned with `@nx/devkit` Tree interface

---

## Design Goals

1. **Zero external dependencies**: Pure Node.js implementation
2. **Synchronous operations**: All methods use sync fs APIs per ESLint rule
3. **Transaction isolation**: Changes isolated until explicitly committed
4. **Memory efficient**: Stream large files, don't buffer entire directories
5. **NX compatible**: Drop-in replacement when @nx/devkit not available

---

## Core Interface

```typescript
// vfs/types.ts

/**
 * Mode for writing files.
 */
export const enum Mode {
  /** Overwrite existing files */
  Overwrite = 'overwrite',
  /** Fail if file exists */
  ExclusiveCreate = 'exclusive',
  /** Skip if file exists */
  SkipIfExists = 'skip',
}

/**
 * A single file change in the tree.
 */
export interface FileChange {
  /** Relative path from tree root */
  path: string
  /** Type of change */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** File content (undefined for DELETE) */
  content?: Buffer
  /** Original content for UPDATE (enables diff) */
  originalContent?: Buffer
  /** File mode/permissions */
  mode?: number
}

/**
 * Virtual file system tree supporting transactional modifications.
 */
export interface Tree {
  /** Root directory of the tree */
  readonly root: string

  /**
   * Read file contents as a Buffer.
   * Returns buffered content if file was modified in this transaction.
   * Falls back to disk for unmodified files.
   */
  read(filePath: string): Buffer | null

  /**
   * Read file contents as a string.
   * @param encoding - Text encoding (default: utf-8)
   */
  read(filePath: string, encoding: BufferEncoding): string | null

  /**
   * Write file contents.
   * Buffers change until committed.
   */
  write(filePath: string, content: Buffer | string, options?: WriteOptions): void

  /**
   * Delete a file or directory.
   * Buffers deletion until committed.
   */
  delete(filePath: string): void

  /**
   * Check if file/directory exists.
   * Considers buffered changes.
   */
  exists(filePath: string): boolean

  /**
   * Check if path is a file.
   */
  isFile(filePath: string): boolean

  /**
   * Check if path is a directory.
   */
  isDirectory(filePath: string): boolean

  /**
   * List children of a directory.
   * Considers buffered changes.
   */
  children(dirPath: string): string[]

  /**
   * Rename/move a file.
   */
  rename(from: string, to: string): void

  /**
   * Get all pending changes.
   */
  listChanges(): FileChange[]

  /**
   * Apply callback to file if it exists.
   */
  changeFile(filePath: string, transform: (content: Buffer) => Buffer): void
}

/**
 * Options for write operations.
 */
export interface WriteOptions {
  /** Write mode */
  mode?: Mode
  /** File permissions (e.g., 0o755) */
  permissions?: number
}
```

---

## Implementation

### FsTree - File System Backed Tree

```typescript
// vfs/fs-tree.ts
import { existsSync, statSync, readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs'
import { join, dirname, relative, normalize, isAbsolute } from 'node:path'
import type { Tree, FileChange, WriteOptions, Mode } from './types'

/**
 * Internal record of a file change.
 */
interface ChangeRecord {
  /** Change type */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** New content (null for DELETE) */
  content: Buffer | null
  /** Original content for diffs */
  originalContent: Buffer | null
  /** Target permissions */
  permissions?: number
}

/**
 * File system-backed tree implementation.
 */
export class FsTree implements Tree {
  private readonly _root: string
  private readonly _changes: Map<string, ChangeRecord> = new Map()
  private readonly _isVerbose: boolean
  private readonly _changesLog: string[] = []

  constructor(root: string, options?: TreeOptions) {
    this._root = normalize(root)
    this._isVerbose = options?.verbose ?? false
  }

  get root(): string {
    return this._root
  }

  /**
   * Normalize path to be relative from root.
   */
  private normalizePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return relative(this._root, filePath)
    }
    return normalize(filePath)
  }

  /**
   * Get absolute path on disk.
   */
  private absolutePath(filePath: string): string {
    return join(this._root, this.normalizePath(filePath))
  }

  /**
   * Log change if verbose mode enabled.
   */
  private logChange(type: string, path: string): void {
    if (this._isVerbose) {
      this._changesLog.push(`${type}: ${path}`)
    }
  }

  read(filePath: string): Buffer | null
  read(filePath: string, encoding: BufferEncoding): string | null
  read(filePath: string, encoding?: BufferEncoding): Buffer | string | null {
    const normalPath = this.normalizePath(filePath)

    // Check buffered changes first
    const change = this._changes.get(normalPath)

    if (change) {
      if (change.type === 'DELETE') {
        return null
      }

      if (change.content !== null) {
        return encoding ? change.content.toString(encoding) : change.content
      }
    }

    // Read from disk
    const absPath = this.absolutePath(normalPath)

    if (!existsSync(absPath)) {
      return null
    }

    try {
      const stat = statSync(absPath)
      if (!stat.isFile()) {
        return null
      }

      const content = readFileSync(absPath)
      return encoding ? content.toString(encoding) : content
    } catch {
      return null
    }
  }

  write(filePath: string, content: Buffer | string, options?: WriteOptions): void {
    const normalPath = this.normalizePath(filePath)
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content

    // Check mode restrictions
    const mode = options?.mode ?? Mode.Overwrite

    if (mode === Mode.ExclusiveCreate && this.exists(normalPath)) {
      throw new Error(`File already exists: ${normalPath}`)
    }

    if (mode === Mode.SkipIfExists && this.exists(normalPath)) {
      return
    }

    // Determine if this is CREATE or UPDATE
    const existingChange = this._changes.get(normalPath)
    const existsOnDisk = this.existsOnDisk(normalPath)

    let changeType: 'CREATE' | 'UPDATE'
    let originalContent: Buffer | null = null

    if (existingChange?.type === 'CREATE' || (!existsOnDisk && !existingChange)) {
      changeType = 'CREATE'
    } else {
      changeType = 'UPDATE'
      originalContent = existingChange?.originalContent ?? this.readFromDisk(normalPath)
    }

    this._changes.set(normalPath, {
      type: changeType,
      content: buffer,
      originalContent,
      permissions: options?.permissions,
    })

    this.logChange(changeType, normalPath)
  }

  delete(filePath: string): void {
    const normalPath = this.normalizePath(filePath)

    // If the file was just created in this transaction, simply remove it
    const existingChange = this._changes.get(normalPath)
    if (existingChange?.type === 'CREATE') {
      this._changes.delete(normalPath)
      return
    }

    // Check if it exists on disk
    if (!this.existsOnDisk(normalPath)) {
      // File doesn't exist anywhere, no-op
      return
    }

    // Record deletion
    this._changes.set(normalPath, {
      type: 'DELETE',
      content: null,
      originalContent: this.readFromDisk(normalPath),
    })

    this.logChange('DELETE', normalPath)
  }

  exists(filePath: string): boolean {
    const normalPath = this.normalizePath(filePath)

    // Check buffered changes
    const change = this._changes.get(normalPath)

    if (change) {
      return change.type !== 'DELETE'
    }

    // Check disk
    return this.existsOnDisk(normalPath)
  }

  isFile(filePath: string): boolean {
    const normalPath = this.normalizePath(filePath)

    // Check buffered changes
    const change = this._changes.get(normalPath)

    if (change) {
      // All buffered changes are files (directories handled differently)
      return change.type !== 'DELETE'
    }

    // Check disk
    const absPath = this.absolutePath(normalPath)
    try {
      return existsSync(absPath) && statSync(absPath).isFile()
    } catch {
      return false
    }
  }

  isDirectory(filePath: string): boolean {
    const normalPath = this.normalizePath(filePath)

    // Check for creates in this directory
    for (const [changedPath, change] of this._changes) {
      if (change.type !== 'DELETE' && changedPath.startsWith(normalPath + '/')) {
        return true
      }
    }

    // Check disk
    const absPath = this.absolutePath(normalPath)
    try {
      return existsSync(absPath) && statSync(absPath).isDirectory()
    } catch {
      return false
    }
  }

  children(dirPath: string): string[] {
    const normalPath = this.normalizePath(dirPath)
    const childSet = new Set<string>()

    // Get disk children
    const absPath = this.absolutePath(normalPath)
    try {
      if (existsSync(absPath) && statSync(absPath).isDirectory()) {
        for (const child of readdirSync(absPath)) {
          childSet.add(child)
        }
      }
    } catch {
      // Directory doesn't exist on disk
    }

    // Apply buffered changes
    const prefix = normalPath === '.' || normalPath === '' ? '' : normalPath + '/'

    for (const [changedPath, change] of this._changes) {
      if (!changedPath.startsWith(prefix)) {
        continue
      }

      const relativePath = changedPath.slice(prefix.length)
      const childName = relativePath.split('/')[0]

      if (change.type === 'DELETE') {
        // Only remove if it's a direct child being deleted
        if (!relativePath.includes('/')) {
          childSet.delete(childName)
        }
      } else {
        childSet.add(childName)
      }
    }

    return Array.from(childSet).sort()
  }

  rename(from: string, to: string): void {
    const content = this.read(from)

    if (content === null) {
      throw new Error(`Source file not found: ${from}`)
    }

    this.write(to, content)
    this.delete(from)
  }

  changeFile(filePath: string, transform: (content: Buffer) => Buffer): void {
    const content = this.read(filePath)

    if (content === null) {
      throw new Error(`File not found: ${filePath}`)
    }

    const newContent = transform(content)
    this.write(filePath, newContent)
  }

  listChanges(): FileChange[] {
    const changes: FileChange[] = []

    for (const [path, record] of this._changes) {
      changes.push({
        path,
        type: record.type,
        content: record.content ?? undefined,
        originalContent: record.originalContent ?? undefined,
        mode: record.permissions,
      })
    }

    // Sort by path for consistent output
    return changes.sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * Check if path exists on disk (not considering buffered changes).
   */
  private existsOnDisk(normalPath: string): boolean {
    const absPath = this.absolutePath(normalPath)
    return existsSync(absPath)
  }

  /**
   * Read from disk (not considering buffered changes).
   */
  private readFromDisk(normalPath: string): Buffer | null {
    const absPath = this.absolutePath(normalPath)
    try {
      return readFileSync(absPath)
    } catch {
      return null
    }
  }
}

/**
 * Options for creating a tree.
 */
export interface TreeOptions {
  /** Enable verbose logging */
  verbose?: boolean
}
```

---

## Transaction Management

### Committing Changes

```typescript
// vfs/commit.ts
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Tree, FileChange } from './types'

/**
 * Result of committing changes.
 */
export interface CommitResult {
  /** Number of files created */
  created: number
  /** Number of files updated */
  updated: number
  /** Number of files deleted */
  deleted: number
  /** Paths of all affected files */
  affectedFiles: string[]
  /** Any errors that occurred */
  errors: CommitError[]
}

/**
 * Error during commit.
 */
export interface CommitError {
  path: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  error: Error
}

/**
 * Options for commit operation.
 */
export interface CommitOptions {
  /** Dry run - don't actually write to disk */
  dryRun?: boolean
  /** Continue on error */
  continueOnError?: boolean
  /** Callback before each file operation */
  onBeforeChange?: (change: FileChange) => void
  /** Callback after each file operation */
  onAfterChange?: (change: FileChange) => void
}

/**
 * Commit all buffered changes to disk.
 */
export function commitChanges(tree: Tree, options?: CommitOptions): CommitResult {
  const changes = tree.listChanges()
  const result: CommitResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    affectedFiles: [],
    errors: [],
  }

  if (options?.dryRun) {
    // Count changes without writing
    for (const change of changes) {
      result.affectedFiles.push(change.path)

      switch (change.type) {
        case 'CREATE':
          result.created++
          break
        case 'UPDATE':
          result.updated++
          break
        case 'DELETE':
          result.deleted++
          break
      }
    }

    return result
  }

  // Sort changes: creates first, then updates, then deletes
  const sortedChanges = [...changes].sort((a, b) => {
    const order = { CREATE: 0, UPDATE: 1, DELETE: 2 }
    return order[a.type] - order[b.type]
  })

  for (const change of sortedChanges) {
    options?.onBeforeChange?.(change)

    const absPath = join(tree.root, change.path)

    try {
      switch (change.type) {
        case 'CREATE':
        case 'UPDATE':
          if (change.content !== undefined) {
            // Ensure directory exists
            const dir = dirname(absPath)
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true })
            }

            writeFileSync(absPath, change.content, {
              mode: change.mode ?? 0o644,
            })

            if (change.type === 'CREATE') {
              result.created++
            } else {
              result.updated++
            }
          }
          break

        case 'DELETE':
          if (existsSync(absPath)) {
            try {
              unlinkSync(absPath)
            } catch {
              // Try recursive delete for directories
              rmSync(absPath, { recursive: true })
            }
          }
          result.deleted++
          break
      }

      result.affectedFiles.push(change.path)
      options?.onAfterChange?.(change)
    } catch (error) {
      const commitError: CommitError = {
        path: change.path,
        operation: change.type,
        error: error instanceof Error ? error : new Error(String(error)),
      }

      result.errors.push(commitError)

      if (!options?.continueOnError) {
        break
      }
    }
  }

  return result
}

/**
 * Print a preview of changes without committing.
 */
export function printChanges(tree: Tree): void {
  const changes = tree.listChanges()

  if (changes.length === 0) {
    console.log('No changes to commit')
    return
  }

  console.log(`${changes.length} file(s) will be changed:\n`)

  for (const change of changes) {
    const prefix = change.type === 'CREATE' ? '+ ' : change.type === 'DELETE' ? '- ' : '~ '

    console.log(`${prefix}${change.path}`)
  }
}
```

---

## Diff Generation

```typescript
// vfs/diff.ts
import type { FileChange } from './types'

/**
 * Diff line for display.
 */
export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
  oldLineNo?: number
  newLineNo?: number
}

/**
 * Complete diff for a file change.
 */
export interface FileDiff {
  path: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE'
  lines: DiffLine[]
  additions: number
  deletions: number
}

/**
 * Generate unified diff for a file change.
 */
export function generateDiff(change: FileChange): FileDiff {
  const result: FileDiff = {
    path: change.path,
    changeType: change.type,
    lines: [],
    additions: 0,
    deletions: 0,
  }

  // Add file header
  result.lines.push({
    type: 'header',
    content: `--- a/${change.path}`,
  })
  result.lines.push({
    type: 'header',
    content: `+++ b/${change.path}`,
  })

  if (change.type === 'CREATE') {
    // All lines are additions
    if (change.content) {
      const newLines = change.content.toString('utf-8').split('\n')
      let lineNo = 1

      result.lines.push({
        type: 'header',
        content: `@@ -0,0 +1,${newLines.length} @@`,
      })

      for (const line of newLines) {
        result.lines.push({
          type: 'add',
          content: line,
          newLineNo: lineNo++,
        })
        result.additions++
      }
    }
  } else if (change.type === 'DELETE') {
    // All lines are deletions
    if (change.originalContent) {
      const oldLines = change.originalContent.toString('utf-8').split('\n')
      let lineNo = 1

      result.lines.push({
        type: 'header',
        content: `@@ -1,${oldLines.length} +0,0 @@`,
      })

      for (const line of oldLines) {
        result.lines.push({
          type: 'remove',
          content: line,
          oldLineNo: lineNo++,
        })
        result.deletions++
      }
    }
  } else if (change.type === 'UPDATE') {
    // Compare old and new
    const oldLines = change.originalContent?.toString('utf-8').split('\n') ?? []
    const newLines = change.content?.toString('utf-8').split('\n') ?? []

    // Simple diff algorithm (could be replaced with proper LCS)
    const diff = computeSimpleDiff(oldLines, newLines)

    result.lines.push(...diff.lines)
    result.additions = diff.additions
    result.deletions = diff.deletions
  }

  return result
}

/**
 * Simple line diff using LCS-like approach.
 */
function computeSimpleDiff(oldLines: string[], newLines: string[]): { lines: DiffLine[]; additions: number; deletions: number } {
  const lines: DiffLine[] = []
  let additions = 0
  let deletions = 0

  // Find hunks of changes
  const hunks = findDiffHunks(oldLines, newLines)

  for (const hunk of hunks) {
    lines.push({
      type: 'header',
      content: `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    })

    for (const op of hunk.operations) {
      if (op.type === 'context') {
        lines.push({
          type: 'context',
          content: op.content,
          oldLineNo: op.oldLineNo,
          newLineNo: op.newLineNo,
        })
      } else if (op.type === 'remove') {
        lines.push({
          type: 'remove',
          content: op.content,
          oldLineNo: op.oldLineNo,
        })
        deletions++
      } else if (op.type === 'add') {
        lines.push({
          type: 'add',
          content: op.content,
          newLineNo: op.newLineNo,
        })
        additions++
      }
    }
  }

  return { lines, additions, deletions }
}
```

---

## Dry Run Support

```typescript
// vfs/dry-run.ts
import type { Tree, FileChange } from './types'
import { generateDiff, type FileDiff } from './diff'

/**
 * Result of dry run analysis.
 */
export interface DryRunResult {
  /** All changes that would be made */
  changes: FileChange[]
  /** Number of files that would be created */
  creates: number
  /** Number of files that would be updated */
  updates: number
  /** Number of files that would be deleted */
  deletes: number
  /** Total bytes that would be written */
  bytesWritten: number
  /** Total bytes that would be freed (deletions) */
  bytesFreed: number
  /** Generated diffs for all changes */
  diffs: FileDiff[]
}

/**
 * Analyze what changes would occur without committing.
 */
export function dryRun(tree: Tree): DryRunResult {
  const changes = tree.listChanges()

  let creates = 0
  let updates = 0
  let deletes = 0
  let bytesWritten = 0
  let bytesFreed = 0

  const diffs: FileDiff[] = []

  for (const change of changes) {
    switch (change.type) {
      case 'CREATE':
        creates++
        bytesWritten += change.content?.length ?? 0
        break

      case 'UPDATE':
        updates++
        bytesWritten += change.content?.length ?? 0
        bytesFreed += change.originalContent?.length ?? 0
        break

      case 'DELETE':
        deletes++
        bytesFreed += change.originalContent?.length ?? 0
        break
    }

    // Generate diff for display
    diffs.push(generateDiff(change))
  }

  return {
    changes,
    creates,
    updates,
    deletes,
    bytesWritten,
    bytesFreed,
    diffs,
  }
}

/**
 * Format dry run result for display.
 */
export function formatDryRunResult(result: DryRunResult): string {
  const lines: string[] = []

  lines.push('Dry Run Summary')
  lines.push('===============')
  lines.push('')
  lines.push(`  Creates: ${result.creates} file(s)`)
  lines.push(`  Updates: ${result.updates} file(s)`)
  lines.push(`  Deletes: ${result.deletes} file(s)`)
  lines.push('')
  lines.push(`  Bytes to write: ${formatBytes(result.bytesWritten)}`)
  lines.push(`  Bytes to free:  ${formatBytes(result.bytesFreed)}`)
  lines.push('')

  if (result.changes.length > 0) {
    lines.push('Changes:')

    for (const change of result.changes) {
      const symbol = change.type === 'CREATE' ? '+' : change.type === 'DELETE' ? '-' : '~'

      lines.push(`  ${symbol} ${change.path}`)
    }
  }

  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

---

## Factory Functions

```typescript
// vfs/index.ts
import { FsTree, type TreeOptions } from './fs-tree'
import type { Tree } from './types'

export { Tree, FileChange, Mode, WriteOptions } from './types'
export { FsTree, TreeOptions } from './fs-tree'
export { commitChanges, CommitResult, CommitOptions } from './commit'
export { dryRun, DryRunResult, formatDryRunResult } from './dry-run'
export { generateDiff, FileDiff, DiffLine } from './diff'

/**
 * Create a new Tree instance for the given directory.
 */
export function createTree(root: string, options?: TreeOptions): Tree {
  return new FsTree(root, options)
}

/**
 * Create a Tree from an NX context tree if available.
 * Falls back to FsTree if not in NX context.
 */
export function createTreeFromContext(root: string, nxTree?: unknown): Tree {
  // If NX tree provided and compatible, use it
  if (nxTree && isNxTreeCompatible(nxTree)) {
    return wrapNxTree(nxTree)
  }

  // Fallback to FsTree
  return new FsTree(root)
}

/**
 * Check if object implements NX Tree interface.
 */
function isNxTreeCompatible(obj: unknown): obj is NxTreeLike {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  const tree = obj as Record<string, unknown>

  return (
    typeof tree['root'] === 'string' &&
    typeof tree['read'] === 'function' &&
    typeof tree['write'] === 'function' &&
    typeof tree['exists'] === 'function' &&
    typeof tree['delete'] === 'function'
  )
}

interface NxTreeLike {
  root: string
  read(path: string): Buffer | null
  write(path: string, content: Buffer | string): void
  exists(path: string): boolean
  delete(path: string): void
  listChanges(): Array<{ path: string; type: string }>
}

/**
 * Wrap NX tree in our Tree interface for compatibility.
 */
function wrapNxTree(nxTree: NxTreeLike): Tree {
  return {
    get root() {
      return nxTree.root
    },

    read(filePath: string, encoding?: BufferEncoding) {
      const content = nxTree.read(filePath)
      if (content === null) return null
      return encoding ? content.toString(encoding) : content
    },

    write(filePath: string, content: Buffer | string, options?: WriteOptions) {
      nxTree.write(filePath, content)
    },

    delete(filePath: string) {
      nxTree.delete(filePath)
    },

    exists(filePath: string) {
      return nxTree.exists(filePath)
    },

    isFile(filePath: string) {
      // NX Tree doesn't have isFile, approximate
      return nxTree.exists(filePath) && nxTree.read(filePath) !== null
    },

    isDirectory(filePath: string) {
      // NX Tree doesn't have isDirectory, approximate
      return nxTree.exists(filePath) && nxTree.read(filePath) === null
    },

    children(dirPath: string) {
      // NX Tree doesn't have children, would need fs fallback
      throw new Error('children() not supported with wrapped NX Tree')
    },

    rename(from: string, to: string) {
      const content = nxTree.read(from)
      if (content === null) {
        throw new Error(`Source file not found: ${from}`)
      }
      nxTree.write(to, content)
      nxTree.delete(from)
    },

    changeFile(filePath: string, transform: (content: Buffer) => Buffer) {
      const content = nxTree.read(filePath)
      if (content === null) {
        throw new Error(`File not found: ${filePath}`)
      }
      nxTree.write(filePath, transform(content))
    },

    listChanges() {
      return nxTree.listChanges().map((c) => ({
        path: c.path,
        type: c.type as 'CREATE' | 'UPDATE' | 'DELETE',
      }))
    },
  }
}
```

---

## Related Documents

- [API Design](./02-api-design.md)
- [NX Integration](./08-nx-integration.md)
- [Core Utilities](./03-layers-core-utilities.md)
