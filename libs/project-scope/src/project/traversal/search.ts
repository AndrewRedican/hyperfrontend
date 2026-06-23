import type { Tree } from '../../vfs'
import type { WalkOptions } from './walk'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createScopedLogger } from '../../core/logger'
import { matchGlobPattern } from '../../core/patterns/glob'
import { walkDirectory, walkTree } from './walk'

const searchLogger = createScopedLogger('project-scope:project:search')

/**
 * Options for file and directory search operations.
 */
export interface FindOptions extends WalkOptions {
  /** Return absolute paths */
  absolutePaths?: boolean
  /** Maximum results to return */
  maxResults?: number
}

/**
 * Tests if a path matches at least one pattern from an array of globs,
 * enabling flexible multi-pattern file filtering.
 * Uses safe character-by-character matching to prevent ReDoS attacks.
 *
 * @param path - File path to test
 * @param patterns - Array of glob patterns
 * @returns True if path matches any pattern
 */
function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlobPattern(path, pattern))
}

/**
 * Searches a directory tree for files matching one or more glob patterns,
 * returning relative or absolute paths based on options.
 *
 * @param startPath - Root directory to begin the search
 * @param patterns - Glob patterns (e.g., '*.ts', '**\/*.json') to filter files
 * @param options - Configuration for search behavior
 * @returns List of relative file paths that match the patterns
 *
 * @example Finding files by pattern
 * ```typescript
 * import { findFiles } from '@hyperfrontend/project-scope'
 *
 * // Find all TypeScript files
 * const tsFiles = findFiles('./src', '\*\*\/*.ts')
 *
 * // Find multiple file types
 * const configFiles = findFiles('./', ['\*.json', '\*.yaml', '\*.yml'])
 *
 * // Limit results and get absolute paths
 * const first10 = findFiles('./src', '\*\*\/*.ts', {
 *   maxResults: 10,
 *   absolutePaths: true
 * })
 * ```
 */
export function findFiles(startPath: string, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = isArray(patterns) ? patterns : [patterns]
  searchLogger.debug('Finding files', { startPath, patterns: normalizedPatterns, maxResults: options?.maxResults })

  const results: string[] = []
  const maxResults = options?.maxResults ?? Infinity

  walkDirectory(
    startPath,
    (entry) => {
      if (results.length >= maxResults) {
        return 'stop'
      }

      if (!entry.isFile) {
        return undefined
      }

      if (matchesPatterns(entry.relativePath, <string[]>normalizedPatterns)) {
        results.push(options?.absolutePaths ? entry.path : entry.relativePath)
      }

      return undefined
    },
    options
  )

  searchLogger.debug('File search complete', { startPath, matchCount: results.length })
  return results
}

/**
 * Searches a virtual file system tree for files matching glob patterns,
 * useful for analyzing project structure without disk I/O.
 *
 * @param tree - In-memory virtual file system representation
 * @param patterns - Glob patterns (e.g., '*.ts', '**\/*.json') to filter files
 * @param options - Configuration for search behavior
 * @returns List of virtual file paths that match the patterns
 *
 * @example Finding files in a virtual tree
 * ```typescript
 * import { createTree, findFilesInTree } from '@hyperfrontend/project-scope'
 *
 * const tree = createTree('/workspace')
 * const tsFiles = findFilesInTree(tree, '**\/*.ts', { maxDepth: 3 })
 * // => ['src/index.ts', 'src/utils/helpers.ts']
 * ```
 */
export function findFilesInTree(tree: Tree, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = isArray(patterns) ? patterns : [patterns]
  const results: string[] = []
  const maxResults = options?.maxResults ?? Infinity

  walkTree(
    tree,
    tree.root || '',
    (entry) => {
      if (results.length >= maxResults) {
        return 'stop'
      }

      if (!entry.isFile) {
        return undefined
      }

      if (matchesPatterns(entry.relativePath, <string[]>normalizedPatterns)) {
        results.push(entry.relativePath)
      }

      return undefined
    },
    options
  )

  return results
}

/**
 * Searches a directory tree for directories matching one or more glob patterns,
 * returning relative or absolute paths based on options.
 *
 * @param startPath - Root directory to begin the search
 * @param patterns - Glob patterns to filter directories (supports wildcards)
 * @param options - Configuration for search behavior
 * @returns List of relative directory paths that match the patterns
 *
 * @example Finding directories by pattern
 * ```typescript
 * import { findDirectories } from '@hyperfrontend/project-scope'
 *
 * const componentDirs = findDirectories('./src', 'components')
 * // => ['features/auth/components', 'features/dashboard/components']
 * ```
 */
export function findDirectories(startPath: string, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = isArray(patterns) ? patterns : [patterns]
  const results: string[] = []
  const maxResults = options?.maxResults ?? Infinity

  walkDirectory(
    startPath,
    (entry) => {
      if (results.length >= maxResults) {
        return 'stop'
      }

      if (!entry.isDirectory) {
        return undefined
      }

      if (matchesPatterns(entry.relativePath, <string[]>normalizedPatterns)) {
        results.push(options?.absolutePaths ? entry.path : entry.relativePath)
      }

      return undefined
    },
    options
  )

  return results
}
