import { readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createScopedLogger } from '../logger'
import { createFileSystemError } from './read'
import { isDirectory as checkIsDirectory } from './stat'

const fsDirLogger = createScopedLogger('project-scope:fs:dir')

/**
 * Entry metadata for a directory listing.
 */
export interface DirectoryEntry {
  /** Entry basename */
  name: string
  /** Full path */
  path: string
  /** Is a file */
  isFile: boolean
  /** Is a directory */
  isDirectory: boolean
  /** Is a symbolic link */
  isSymlink: boolean
  /** Directory depth (for recursive listings) */
  depth?: number
}

/**
 * Options for recursive directory listing.
 */
export interface RecursiveOptions {
  /** Maximum depth (-1 or Infinity for unlimited) */
  maxDepth?: number
  /** Include hidden files (dotfiles) */
  includeHidden?: boolean
  /** Follow symbolic links into directories */
  followSymlinks?: boolean
}

/**
 * List immediate contents of a directory.
 *
 * @param dirPath - Absolute or relative path to the directory
 * @returns Array of entries with metadata for each file/directory
 * @throws {Error} If directory doesn't exist or isn't a directory
 *
 * @example
 * ```typescript
 * import { readDirectory } from '@hyperfrontend/project-scope'
 *
 * const entries = readDirectory('./src')
 * for (const entry of entries) {
 *   console.log(entry.name, entry.isFile ? 'file' : 'directory')
 * }
 * ```
 */
export function readDirectory(dirPath: string): DirectoryEntry[] {
  fsDirLogger.debug('Reading directory', { path: dirPath })

  if (!existsSync(dirPath)) {
    fsDirLogger.debug('Directory not found', { path: dirPath })
    throw createFileSystemError(`Directory not found: ${dirPath}`, 'FS_NOT_FOUND', { path: dirPath, operation: 'readdir' })
  }

  if (!checkIsDirectory(dirPath)) {
    fsDirLogger.debug('Path is not a directory', { path: dirPath })
    throw createFileSystemError(`Not a directory: ${dirPath}`, 'FS_NOT_A_DIRECTORY', { path: dirPath, operation: 'readdir' })
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    fsDirLogger.debug('Directory read complete', { path: dirPath, entryCount: entries.length })
    return entries.map((entry) => ({
      name: entry.name,
      path: join(dirPath, entry.name),
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
      isSymlink: entry.isSymbolicLink(),
    }))
  } catch (error) {
    fsDirLogger.warn('Failed to read directory', { path: dirPath, error: error instanceof Error ? error.message : String(error) })
    throw createFileSystemError(`Failed to read directory: ${dirPath}`, 'FS_READ_ERROR', {
      path: dirPath,
      operation: 'readdir',
      cause: error,
    })
  }
}

/**
 * List directory contents recursively with depth tracking.
 *
 * @param dirPath - Root directory path to start traversal
 * @param options - Configuration for depth limit, hidden files, and symlinks
 * @returns Flat array of all entries found during traversal
 *
 * @example
 * ```typescript
 * import { readDirectoryRecursive } from '@hyperfrontend/project-scope'
 *
 * // List all files up to 3 levels deep
 * const entries = readDirectoryRecursive('./src', { maxDepth: 3 })
 *
 * // Include hidden files
 * const allEntries = readDirectoryRecursive('./project', { includeHidden: true })
 * ```
 */
export function readDirectoryRecursive(dirPath: string, options?: RecursiveOptions): DirectoryEntry[] {
  const maxDepth = options?.maxDepth ?? Infinity
  const includeHidden = options?.includeHidden ?? false
  const followSymlinks = options?.followSymlinks ?? false

  fsDirLogger.debug('Starting recursive directory read', {
    path: dirPath,
    maxDepth: maxDepth === Infinity ? 'unlimited' : maxDepth,
    includeHidden,
    followSymlinks,
  })

  const results: DirectoryEntry[] = []

  /**
   * Recursively walk directories and collect entries.
   *
   * @param currentPath - Current directory being processed
   * @param depth - Current depth level from the starting directory
   */
  function walk(currentPath: string, depth: number): void {
    if (depth > maxDepth) {
      fsDirLogger.debug('Max depth reached, skipping', { path: currentPath, depth, maxDepth })
      return
    }

    let entries: DirectoryEntry[]
    try {
      entries = readDirectory(currentPath)
    } catch {
      fsDirLogger.debug('Skipping inaccessible directory', { path: currentPath })
      return
    }

    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }

      results.push({ ...entry, depth })

      if (entry.isDirectory || (entry.isSymlink && followSymlinks && checkIsDirectory(entry.path))) {
        walk(entry.path, depth + 1)
      }
    }
  }

  walk(dirPath, 0)
  fsDirLogger.debug('Recursive directory read complete', { path: dirPath, totalEntries: results.length })
  return results
}

/**
 * Create a directory, optionally creating parent directories.
 *
 * @param dirPath - Path where the directory should be created
 * @param options - Creation options
 * @param options.recursive - Create parent directories if missing (default: true)
 */
export function createDirectory(dirPath: string, options?: { recursive?: boolean }): void {
  const recursive = options?.recursive ?? true
  fsDirLogger.debug('Creating directory', { path: dirPath, recursive })
  mkdirSync(dirPath, { recursive })
}

/**
 * Delete a directory from the filesystem.
 *
 * @param dirPath - Path to the directory to remove
 * @param options - Removal configuration
 * @param options.recursive - Delete directory contents recursively
 * @param options.force - Ignore errors if directory doesn't exist
 */
export function removeDirectory(dirPath: string, options?: { recursive?: boolean; force?: boolean }): void {
  fsDirLogger.debug('Removing directory', { path: dirPath, recursive: options?.recursive, force: options?.force })
  rmSync(dirPath, {
    recursive: options?.recursive ?? false,
    force: options?.force ?? false,
  })
}
