import { statSync, lstatSync, existsSync } from 'node:fs'

/**
 * File statistics.
 */
export interface FileStats {
  /** Is a file */
  isFile: boolean
  /** Is a directory */
  isDirectory: boolean
  /** Is a symbolic link */
  isSymlink: boolean
  /** File size in bytes */
  size: number
  /** Creation time */
  created: Date
  /** Modification time */
  modified: Date
  /** Last access time */
  accessed: Date
  /** File mode/permissions */
  mode: number
}

/**
 * Get file stats with error handling.
 *
 * @param filePath - Path to file
 * @param followSymlinks - Whether to follow symlinks (default: true)
 * @returns File stats or null if path doesn't exist
 */
export function getFileStat(filePath: string, followSymlinks = true): FileStats | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const stat = followSymlinks ? statSync(filePath) : lstatSync(filePath)
    return {
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymlink: stat.isSymbolicLink(),
      size: stat.size,
      created: stat.birthtime,
      modified: stat.mtime,
      accessed: stat.atime,
      mode: stat.mode,
    }
  } catch {
    return null
  }
}

/**
 * Check if path is a file.
 *
 * @param filePath - Path to check
 * @returns True if path is a file
 */
export function isFile(filePath: string): boolean {
  const stats = getFileStat(filePath)
  return stats?.isFile ?? false
}

/**
 * Check if path is a directory.
 *
 * @param dirPath - Path to check
 * @returns True if path is a directory
 */
export function isDirectory(dirPath: string): boolean {
  const stats = getFileStat(dirPath)
  return stats?.isDirectory ?? false
}

/**
 * Check if path is a symbolic link.
 *
 * @param linkPath - Path to check
 * @returns True if path is a symlink
 */
export function isSymlink(linkPath: string): boolean {
  const stats = getFileStat(linkPath, false)
  return stats?.isSymlink ?? false
}

/**
 * Check if path exists.
 *
 * @param filePath - Path to check
 * @returns True if path exists
 */
export function exists(filePath: string): boolean {
  return existsSync(filePath)
}
