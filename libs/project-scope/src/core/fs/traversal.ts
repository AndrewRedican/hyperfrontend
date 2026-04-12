import { resolve, dirname, parse } from 'node:path'
import { createScopedLogger } from '../logger'
import { join } from '../path'
import { exists } from './stat'

const fsTraversalLogger = createScopedLogger('project-scope:fs:traversal')

/**
 * Generic upward directory traversal.
 * Name avoids similarity to fs.readdir/fs.readdirSync.
 *
 * @param startPath - Starting directory
 * @param predicate - Function to test each directory
 * @returns First matching directory or null
 *
 * @example Finding directory containing README
 * ```typescript
 * // Find first directory containing a README
 * const readmeDir = traverseUpward('./src/utils', (dir) =>
 *   existsSync(join(dir, 'README.md'))
 * )
 * // => '/project' or null
 * ```
 */
export function traverseUpward(startPath: string, predicate: (dirPath: string) => boolean): string | null {
  fsTraversalLogger.debug('Starting upward traversal', { startPath })
  let currentPath = resolve(startPath)
  const rootPath = parse(currentPath).root

  while (currentPath !== rootPath) {
    if (predicate(currentPath)) {
      fsTraversalLogger.debug('Upward traversal found match', { startPath, foundPath: currentPath })
      return currentPath
    }
    currentPath = dirname(currentPath)
  }

  if (predicate(rootPath)) {
    fsTraversalLogger.debug('Upward traversal found match at root', { startPath, foundPath: rootPath })
    return rootPath
  }

  fsTraversalLogger.debug('Upward traversal found no match', { startPath })
  return null
}

/**
 * Find directory containing any of the specified marker files.
 *
 * @param startPath - Starting directory
 * @param markers - Array of marker file names to search for
 * @returns First directory containing any marker, or null
 *
 * @example Finding project root by marker files
 * ```typescript
 * // Find project root by looking for common marker files
 * const projectRoot = locateByMarkers('./src/components', [
 *   'package.json',
 *   'nx.json',
 *   'tsconfig.base.json'
 * ])
 * // => '/workspace/my-project'
 * ```
 */
export function locateByMarkers(startPath: string, markers: readonly string[]): string | null {
  fsTraversalLogger.debug('Locating by markers', { startPath, markers })
  const result = traverseUpward(startPath, (dir) => markers.some((marker) => exists(join(dir, marker))))
  if (result) {
    fsTraversalLogger.debug('Found directory with marker', { startPath, foundPath: result })
  }
  return result
}

/**
 * Find directory where predicate returns true, starting from given path.
 *
 * @param startPath - Starting directory
 * @param test - Function to test if directory matches criteria
 * @returns Matching directory path or null
 *
 * @example Finding directory with specific config
 * ```typescript
 * // Find directory with a specific config
 * const configDir = findUpwardWhere('./deep/nested/path', (dir) =>
 *   existsSync(join(dir, '.eslintrc.js'))
 * )
 * ```
 */
export function findUpwardWhere(startPath: string, test: (dirPath: string) => boolean): string | null {
  fsTraversalLogger.debug('Finding upward where condition met', { startPath })
  return traverseUpward(startPath, test)
}
