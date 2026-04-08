import type { Tree, FileChange, WriteOptions, CreateTreeOptions, ModeType } from './types'
import { readFileSync, lstatSync, readlinkSync } from 'node:fs'
import { from as arrayFrom } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists as fsExists, isFile as fsIsFile, isDirectory as fsIsDirectory, readDirectory } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { normalizePath, joinPath, relativePath, isAbsolute, removeTrailingSlash, resolvePath, getDirname } from '../core/path'
import { Mode } from './types'

const fsTreeLogger = createScopedLogger('project-scope:vfs:tree')

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
 * Create a file system-backed tree implementation.
 *
 * Supports transactional modifications - all changes are buffered
 * in memory and can be committed atomically or rolled back.
 *
 * @param root - Absolute path to the workspace root directory
 * @param options - Configuration for verbose logging
 * @returns A Tree instance
 *
 * @example
 * ```typescript
 * import { createFsTree, commitChanges } from '@hyperfrontend/project-scope'
 *
 * const tree = createFsTree('/workspace')
 * tree.write('src/new-file.ts', 'export const value = 42')
 * tree.delete('old-file.ts')
 * commitChanges(tree) // Atomically apply all changes to disk
 * ```
 */
export function createFsTree(root: string, options?: CreateTreeOptions): Tree {
  const _root = removeTrailingSlash(normalizePath(root))
  const _changes: Map<string, ChangeRecord> = createMap()
  const _isVerbose = options?.verbose ?? false
  const _followSymlinks = options?.followSymlinks ?? true
  const _changesLog: string[] = []

  fsTreeLogger.debug('Creating VFS tree', { root: _root, verbose: _isVerbose, followSymlinks: _followSymlinks })

  /**
   * Normalize path to be relative from root.
   *
   * @param filePath - Path to normalize
   * @returns Normalized relative path
   * @throws {Error} if path traverses outside the tree root
   */
  function normalizeFilePath(filePath: string): string {
    const normalized = isAbsolute(filePath) ? relativePath(_root, filePath) : normalizePath(filePath)

    const absoluteResolved = resolvePath(_root, normalized)
    if (!absoluteResolved.startsWith(_root + '/') && absoluteResolved !== _root) {
      throw createError(`Path escapes tree root: ${filePath}`)
    }

    return normalized
  }

  /**
   * Get absolute path on disk.
   *
   * @param filePath - Relative path from root
   * @returns Absolute path on disk
   */
  function absolutePath(filePath: string): string {
    return joinPath(_root, normalizeFilePath(filePath))
  }

  /**
   * Log change if verbose mode enabled.
   *
   * @param type - Type of change (CREATE, UPDATE, DELETE)
   * @param path - Path of changed file
   */
  function logChange(type: string, path: string): void {
    if (_isVerbose) {
      _changesLog.push(`${type}: ${path}`)
    }
  }

  /**
   * Check if a normalized path is a symbolic link.
   *
   * @param normalPath - Already normalized path
   * @returns True if path is a symlink
   */
  function isSymlinkNormalizedPath(normalPath: string): boolean {
    const absPath = absolutePath(normalPath)

    try {
      const stats = lstatSync(absPath)
      return stats.isSymbolicLink()
    } catch {
      return false
    }
  }

  /**
   * Validate that a symlink target stays within tree bounds.
   *
   * @param normalPath - Already normalized path to symlink
   * @throws {Error} If symlink target escapes tree root or followSymlinks is disabled
   */
  function validateSymlink(normalPath: string): void {
    const absPath = absolutePath(normalPath)

    if (!isSymlinkNormalizedPath(normalPath)) {
      return
    }

    if (!_followSymlinks) {
      throw createError(`Cannot access symlink when followSymlinks is disabled: ${normalPath}`)
    }

    try {
      const target = readlinkSync(absPath)

      let targetAbsolute: string
      if (isAbsolute(target)) {
        targetAbsolute = target
      } else {
        const symlinkDir = getDirname(absPath)
        targetAbsolute = resolvePath(symlinkDir, target)
      }

      const normalizedTarget = normalizePath(targetAbsolute)

      if (!normalizedTarget.startsWith(_root + '/') && normalizedTarget !== _root) {
        throw createError(`Symlink target escapes tree root: ${normalPath} -> ${target}`)
      }
    } catch (error) {
      /* istanbul ignore else -- other errors are rare edge cases (e.g., permission denied) */
      if (error instanceof Error && error.message.includes('Symlink target escapes')) {
        throw error
      }
      if (error instanceof Error && error.message.includes('followSymlinks is disabled')) {
        throw error
      }
      throw createError(`Failed to validate symlink: ${normalPath}`)
    }
  }

  /**
   * Check if path exists on disk (not considering buffered changes).
   *
   * @param normalPath - Normalized path to check
   * @returns True if exists on disk
   */
  function existsOnDisk(normalPath: string): boolean {
    const absPath = absolutePath(normalPath)
    return fsExists(absPath)
  }

  /**
   * Read from disk (not considering buffered changes).
   *
   * @param normalPath - Normalized path to read
   * @returns File content or null
   */
  function readFromDisk(normalPath: string): Buffer | null {
    validateSymlink(normalPath)

    const absPath = absolutePath(normalPath)
    if (!fsIsFile(absPath)) {
      return null
    }
    try {
      return readFileSync(absPath)
    } catch {
      return null
    }
  }

  const tree: Tree = {
    get root(): string {
      return _root
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    read(filePath: string, encoding?: BufferEncoding): any {
      const normalPath = normalizeFilePath(filePath)

      const change = _changes.get(normalPath)

      if (change) {
        if (change.type === 'DELETE') {
          return null
        }

        if (change.content !== null) {
          return encoding ? change.content.toString(encoding) : change.content
        }
      }

      validateSymlink(normalPath)

      const absPath = absolutePath(normalPath)

      if (!fsExists(absPath)) {
        return null
      }

      if (!fsIsFile(absPath)) {
        return null
      }

      try {
        const content = readFileSync(absPath)
        return encoding ? content.toString(encoding) : content
      } catch {
        return null
      }
    },

    write(filePath: string, content: Buffer | string, options?: WriteOptions): void {
      const normalPath = normalizeFilePath(filePath)
      const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
      fsTreeLogger.debug('write', { path: normalPath, size: buffer.length, mode: options?.mode ?? 'Overwrite' })

      const mode: ModeType = options?.mode ?? Mode.Overwrite

      if (mode === Mode.ExclusiveCreate && this.exists(normalPath)) {
        throw createError(`File already exists: ${normalPath}`)
      }

      if (mode === Mode.SkipIfExists && this.exists(normalPath)) {
        return
      }

      const existingChange = _changes.get(normalPath)
      const diskExists = existsOnDisk(normalPath)

      let changeType: 'CREATE' | 'UPDATE'
      let originalContent: Buffer | null = null

      if (existingChange?.type === 'CREATE' || (!diskExists && !existingChange)) {
        changeType = 'CREATE'
      } else {
        changeType = 'UPDATE'
        originalContent = existingChange?.originalContent ?? readFromDisk(normalPath)
      }

      _changes.set(normalPath, {
        type: changeType,
        content: buffer,
        originalContent,
        permissions: options?.permissions,
      })

      logChange(changeType, normalPath)
    },

    exists(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)

      const change = _changes.get(normalPath)

      if (change) {
        return change.type !== 'DELETE'
      }

      for (const [changedPath, record] of _changes) {
        if (record.type !== 'DELETE' && changedPath.startsWith(normalPath + '/')) {
          return true
        }
      }

      return existsOnDisk(normalPath)
    },

    delete(filePath: string): void {
      const normalPath = normalizeFilePath(filePath)
      fsTreeLogger.debug('delete', { path: normalPath })

      const existingChange = _changes.get(normalPath)
      if (existingChange?.type === 'CREATE') {
        _changes.delete(normalPath)
        return
      }

      if (!existsOnDisk(normalPath)) {
        return
      }

      _changes.set(normalPath, {
        type: 'DELETE',
        content: null,
        originalContent: readFromDisk(normalPath),
      })

      logChange('DELETE', normalPath)
    },

    rename(from: string, to: string): void {
      const content = this.read(from)

      if (content === null) {
        throw createError(`Source file not found: ${from}`)
      }

      this.write(to, content)
      this.delete(from)
    },

    isFile(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)

      const change = _changes.get(normalPath)

      if (change) {
        return change.type !== 'DELETE'
      }

      const absPath = absolutePath(normalPath)
      return fsIsFile(absPath)
    },

    isDirectory(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)

      for (const [changedPath, change] of _changes) {
        if (change.type !== 'DELETE' && changedPath.startsWith(normalPath + '/')) {
          return true
        }
      }

      const absPath = absolutePath(normalPath)
      return fsIsDirectory(absPath)
    },

    isSymlink(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)
      return isSymlinkNormalizedPath(normalPath)
    },

    children(dirPath: string): string[] {
      const normalPath = normalizeFilePath(dirPath)
      const childSet = createSet<string>()

      const absPath = absolutePath(normalPath)
      try {
        if (fsExists(absPath) && fsIsDirectory(absPath)) {
          const entries = readDirectory(absPath)
          for (const entry of entries) {
            childSet.add(entry.name)
          }
        }
      } catch {
        // Directory doesn't exist on disk
      }

      const prefix = normalPath === '.' || normalPath === '' ? '' : normalPath + '/'

      for (const [changedPath, change] of _changes) {
        if (prefix === '') {
          const childName = changedPath.split('/')[0]
          if (change.type === 'DELETE' && !changedPath.includes('/')) {
            childSet.delete(childName)
          } else if (change.type !== 'DELETE') {
            childSet.add(childName)
          }
          continue
        }

        if (!changedPath.startsWith(prefix)) {
          continue
        }

        const relativePath = changedPath.slice(prefix.length)
        const childName = relativePath.split('/')[0]

        if (change.type === 'DELETE') {
          if (!relativePath.includes('/')) {
            childSet.delete(childName)
          }
        } else {
          childSet.add(childName)
        }
      }

      return arrayFrom(childSet).sort()
    },

    listChanges(): FileChange[] {
      const changes: FileChange[] = []

      for (const [path, record] of _changes) {
        changes.push({
          path,
          type: record.type,
          content: record.content ?? undefined,
          originalContent: record.originalContent ?? undefined,
          mode: record.permissions,
        })
      }

      return changes.sort((a, b) => a.path.localeCompare(b.path))
    },

    changePermissions(filePath: string, mode: number): void {
      const normalPath = normalizeFilePath(filePath)

      if (!this.exists(normalPath)) {
        throw createError(`File not found: ${normalPath}`)
      }

      const existingChange = _changes.get(normalPath)

      if (existingChange) {
        existingChange.permissions = mode
      } else {
        const content = readFromDisk(normalPath)
        _changes.set(normalPath, {
          type: 'UPDATE',
          content,
          originalContent: content,
          permissions: mode,
        })
      }

      logChange('CHMOD', normalPath)
    },

    changeFile(filePath: string, transform: (content: Buffer) => Buffer): void {
      const content = this.read(filePath)

      if (content === null) {
        throw createError(`File not found: ${filePath}`)
      }

      const newContent = transform(content)
      this.write(filePath, newContent)
    },

    clearChanges(): void {
      _changes.clear()
      _changesLog.length = 0
    },
  }

  return tree
}
