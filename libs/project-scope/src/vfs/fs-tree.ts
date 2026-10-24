import type { TreeStore } from './store'
import type { Tree, FileChange, WriteOptions, CreateTreeOptions, ModeType } from './types'
import { posix } from 'node:path'
import { from as arrayFrom } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isSafePath } from '../core/fs/guard'
import { createScopedLogger } from '../core/logger'
import { normalizePath, joinPath, relativePath, isAbsolute, removeTrailingSlash, resolvePath, getDirname } from '../core/path'
import { diskStore } from './store'
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
 * @example Creating and using a file system tree
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
  return createStoreTree(root, diskStore, options)
}

/**
 * Create a tree that buffers its changes over a store holding the files it has not changed.
 *
 * @param root - Absolute path of the tree's root
 * @param store - Where unchanged files are read from
 * @param options - Configuration for verbose logging and symlink handling
 * @returns A Tree whose reads fall through to the store
 *
 * @example Building a tree over a store
 * ```typescript
 * const tree = createStoreTree('/workspace', diskStore)
 * tree.read('package.json', 'utf-8')
 * ```
 */
export function createStoreTree(root: string, store: TreeStore, options?: CreateTreeOptions): Tree {
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
   * @throws {Error} if the path carries a NUL byte or traverses outside the tree root
   */
  function normalizeFilePath(filePath: string): string {
    // why: a NUL byte truncates the path inside the syscall, so a buffered write would target a file nobody validated; rejecting it here fails the call instead of the commit.
    if (!isSafePath(filePath)) {
      throw createError(`Unsafe path (NUL byte): ${filePath}`)
    }

    const normalized = isAbsolute(filePath) ? relativePath(_root, filePath) : normalizePath(filePath)

    const absoluteResolved = resolvePath(_root, normalized)
    if (!absoluteResolved.startsWith(_root + posix.sep) && absoluteResolved !== _root) {
      throw createError(`Path escapes tree root: ${filePath}`)
    }

    return normalized
  }

  /**
   * Get the absolute path the store is asked about.
   *
   * @param filePath - Relative path from root
   * @returns Absolute path under the root
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
    return store.isSymlink(absolutePath(normalPath))
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
      const target = store.readlink(absPath)

      let targetAbsolute: string
      if (isAbsolute(target)) {
        targetAbsolute = target
      } else {
        const symlinkDir = getDirname(absPath)
        targetAbsolute = resolvePath(symlinkDir, target)
      }

      const normalizedTarget = normalizePath(targetAbsolute)

      if (!normalizedTarget.startsWith(_root + posix.sep) && normalizedTarget !== _root) {
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
   * Check if path exists in the store (not considering buffered changes).
   *
   * @param normalPath - Normalized path to check
   * @returns True if the store holds it
   */
  function existsInStore(normalPath: string): boolean {
    return store.exists(absolutePath(normalPath))
  }

  /**
   * Read from the store (not considering buffered changes).
   *
   * @param normalPath - Normalized path to read
   * @returns File content or null
   */
  function readFromStore(normalPath: string): Buffer | null {
    validateSymlink(normalPath)
    return store.read(absolutePath(normalPath))
  }

  const tree: Tree = {
    get root(): string {
      return _root
    },

    // lint-disable-next-line typescript/no-explicit-any
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

      const content = readFromStore(normalPath)
      if (content === null) {
        return null
      }
      return encoding ? content.toString(encoding) : content
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
      const diskExists = existsInStore(normalPath)

      let changeType: 'CREATE' | 'UPDATE'
      let originalContent: Buffer | null = null

      if (existingChange?.type === 'CREATE' || (!diskExists && !existingChange)) {
        changeType = 'CREATE'
      } else {
        changeType = 'UPDATE'
        originalContent = existingChange?.originalContent ?? readFromStore(normalPath)
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
        if (record.type !== 'DELETE' && changedPath.startsWith(normalPath + posix.sep)) {
          return true
        }
      }

      return existsInStore(normalPath)
    },

    delete(filePath: string): void {
      const normalPath = normalizeFilePath(filePath)
      fsTreeLogger.debug('delete', { path: normalPath })

      const existingChange = _changes.get(normalPath)
      if (existingChange?.type === 'CREATE') {
        _changes.delete(normalPath)
        return
      }

      if (!existsInStore(normalPath)) {
        return
      }

      _changes.set(normalPath, {
        type: 'DELETE',
        content: null,
        originalContent: readFromStore(normalPath),
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

      return store.isFile(absolutePath(normalPath))
    },

    isDirectory(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)
      validateSymlink(normalPath)

      for (const [changedPath, change] of _changes) {
        if (change.type !== 'DELETE' && changedPath.startsWith(normalPath + posix.sep)) {
          return true
        }
      }

      return store.isDirectory(absolutePath(normalPath))
    },

    isSymlink(filePath: string): boolean {
      const normalPath = normalizeFilePath(filePath)
      return isSymlinkNormalizedPath(normalPath)
    },

    children(dirPath: string): string[] {
      const normalPath = normalizeFilePath(dirPath)
      validateSymlink(normalPath)

      const childSet = createSet<string>()

      const absPath = absolutePath(normalPath)
      if (store.isDirectory(absPath)) {
        for (const name of store.list(absPath)) {
          childSet.add(name)
        }
      }

      const prefix = normalPath === '.' || normalPath === '' ? '' : normalPath + posix.sep

      for (const [changedPath, change] of _changes) {
        if (prefix === '') {
          const childName = changedPath.split(posix.sep)[0]
          if (change.type === 'DELETE' && !changedPath.includes(posix.sep)) {
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
        const childName = relativePath.split(posix.sep)[0]

        if (change.type === 'DELETE') {
          if (!relativePath.includes(posix.sep)) {
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
        const content = readFromStore(normalPath)
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
