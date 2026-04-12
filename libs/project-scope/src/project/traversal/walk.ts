import type { Tree } from '../../vfs'
import { join } from 'node:path'
import { readDirectory, readFileIfExists } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { matchGlobPattern } from '../../core/patterns/glob'

const walkLogger = createScopedLogger('project-scope:project:walk')

/**
 * Walk entry representing a file or directory.
 */
export interface WalkEntry {
  /** Entry basename */
  name: string
  /** Full path */
  path: string
  /** Relative path from start */
  relativePath: string
  /** Is a file */
  isFile: boolean
  /** Is a directory */
  isDirectory: boolean
  /** Is a symbolic link */
  isSymlink: boolean
  /** Depth from start directory */
  depth: number
}

/**
 * Configuration for directory traversal behavior.
 */
export interface WalkOptions {
  /** Maximum depth (-1 for unlimited) */
  maxDepth?: number
  /** Include hidden files (dotfiles) */
  includeHidden?: boolean
  /** Glob patterns to ignore */
  ignorePatterns?: string[]
  /** Respect .gitignore */
  respectGitignore?: boolean
}

/**
 * Visitor function signature.
 */
export type WalkVisitorResult = void | 'skip' | 'stop'

/**
 * Walk visitor function.
 */
export type WalkVisitor = (entry: WalkEntry) => WalkVisitorResult

/**
 * Reads .gitignore file from the given directory and extracts
 * non-comment patterns for use in file traversal filtering.
 *
 * @param startPath - Directory containing the .gitignore file
 * @returns Array of gitignore patterns
 */
function loadGitignorePatterns(startPath: string): string[] {
  const patterns: string[] = []

  const gitignorePath = join(startPath, '.gitignore')
  const content = readFileIfExists(gitignorePath)
  if (content) {
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        patterns.push(trimmed)
      }
    }
  }

  return patterns
}

/**
 * Evaluates whether a relative path should be ignored based on
 * a list of gitignore-style patterns.
 *
 * @param relativePath - Path relative to the root directory
 * @param patterns - Array of gitignore-style patterns to test
 * @returns True if the path matches any ignore pattern
 */
function matchesIgnorePattern(relativePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchPattern(relativePath, pattern)) {
      return true
    }
  }
  return false
}

/**
 * Tests if the given path matches a gitignore-style pattern,
 * supporting negation patterns with '!' prefix.
 * Uses safe character-by-character matching to prevent ReDoS attacks.
 *
 * @param path - File or directory path to test
 * @param pattern - Gitignore-style pattern (may include wildcards)
 * @returns True if the path matches the pattern (or doesn't match if negated)
 */
function matchPattern(path: string, pattern: string): boolean {
  const normalizedPattern = pattern.startsWith('/') ? pattern.slice(1) : pattern
  const isNegation = normalizedPattern.startsWith('!')

  const actualPattern = isNegation ? normalizedPattern.slice(1) : normalizedPattern

  const matchesFullPath = matchGlobPattern(path, actualPattern) || matchGlobPattern(path, `**/${actualPattern}`)

  const matchesSegment = path.split('/').some((segment) => matchGlobPattern(segment, actualPattern))

  const matches = matchesFullPath || matchesSegment

  return isNegation ? !matches : matches
}

/**
 * Traverses a directory tree synchronously, calling a visitor function
 * for each file and directory encountered. Supports depth limiting,
 * hidden file filtering, and gitignore pattern matching.
 *
 * @param startPath - Root directory to begin traversal
 * @param visitor - Callback function invoked for each file system entry
 * @param options - Configuration for traversal behavior
 *
 * @example Walking a directory tree
 * ```typescript
 * import { walkDirectory } from '@hyperfrontend/project-scope'
 *
 * const tsFiles: string[] = []
 * walkDirectory('./src', (entry) => {
 *   if (entry.isFile && entry.name.endsWith('.ts')) {
 *     tsFiles.push(entry.relativePath)
 *   }
 * }, { maxDepth: 5, respectGitignore: true })
 * ```
 */
export function walkDirectory(startPath: string, visitor: WalkVisitor, options?: WalkOptions): void {
  walkLogger.debug('Starting directory walk', {
    startPath,
    maxDepth: options?.maxDepth ?? -1,
    includeHidden: options?.includeHidden ?? false,
    respectGitignore: options?.respectGitignore ?? true,
    ignorePatterns: options?.ignorePatterns?.length ?? 0,
  })

  const maxDepth = options?.maxDepth ?? -1
  const includeHidden = options?.includeHidden ?? false
  const ignorePatterns = options?.ignorePatterns ?? []
  const respectGitignore = options?.respectGitignore ?? true

  const gitignorePatterns = respectGitignore ? loadGitignorePatterns(startPath) : []
  const allIgnorePatterns = [...ignorePatterns, ...gitignorePatterns]

  if (gitignorePatterns.length > 0) {
    walkLogger.debug('Loaded gitignore patterns', { count: gitignorePatterns.length })
  }

  /**
   * Recursively walks directory entries, applying visitor to each.
   *
   * @param currentPath - Absolute path to current directory
   * @param relativePath - Path relative to the starting directory
   * @param depth - Current recursion depth
   * @returns False to stop walking, true to continue
   */
  function walk(currentPath: string, relativePath: string, depth: number): boolean {
    if (maxDepth !== -1 && depth > maxDepth) {
      return true
    }

    let entries
    try {
      entries = readDirectory(currentPath)
    } catch {
      return true
    }

    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }

      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (matchesIgnorePattern(entryRelativePath, allIgnorePatterns)) {
        continue
      }

      const walkEntry: WalkEntry = {
        name: entry.name,
        path: entry.path,
        relativePath: entryRelativePath,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
        depth,
      }

      const result = visitor(walkEntry)

      if (result === 'stop') {
        return false
      }

      if (result === 'skip') {
        continue
      }

      if (entry.isDirectory) {
        const shouldContinue = walk(entry.path, entryRelativePath, depth + 1)
        if (!shouldContinue) {
          return false
        }
      }
    }

    return true
  }

  walk(startPath, '', 0)
  walkLogger.debug('Directory walk complete', { startPath })
}

/**
 * Traverses a virtual file system tree, calling a visitor function
 * for each file and directory. Operates on in-memory tree structure
 * without disk I/O.
 *
 * @param tree - In-memory virtual file system representation
 * @param startPath - Root path within the tree to begin traversal
 * @param visitor - Callback function invoked for each tree entry
 * @param options - Configuration for traversal behavior
 *
 * @example Walking a virtual tree
 * ```typescript
 * import { createTree, walkTree } from '@hyperfrontend/project-scope'
 *
 * const tree = createTree('/workspace')
 * walkTree(tree, 'src', (entry) => {
 *   if (entry.isDirectory) {
 *     console.log('Dir:', entry.relativePath)
 *     return 'skip' // Don't recurse into this directory
 *   }
 * })
 * ```
 */
export function walkTree(tree: Tree, startPath: string, visitor: WalkVisitor, options?: WalkOptions): void {
  const maxDepth = options?.maxDepth ?? -1
  const includeHidden = options?.includeHidden ?? false

  /**
   * Recursively walks tree entries, applying visitor to each.
   *
   * @param currentPath - Current path within the tree
   * @param relativePath - Path relative to the starting path
   * @param depth - Current recursion depth
   * @returns False to stop walking, true to continue
   */
  function walk(currentPath: string, relativePath: string, depth: number): boolean {
    if (maxDepth !== -1 && depth > maxDepth) {
      return true
    }

    let children: string[]
    try {
      children = tree.children(currentPath)
    } catch {
      return true
    }

    for (const name of children) {
      if (!includeHidden && name.startsWith('.')) {
        continue
      }

      const childPath = currentPath ? `${currentPath}/${name}` : name
      const entryRelativePath = relativePath ? `${relativePath}/${name}` : name

      const isFileEntry = tree.isFile(childPath)

      const walkEntry: WalkEntry = {
        name,
        path: childPath,
        relativePath: entryRelativePath,
        isFile: isFileEntry,
        isDirectory: !isFileEntry,
        isSymlink: false,
        depth,
      }

      const result = visitor(walkEntry)

      if (result === 'stop') {
        return false
      }

      if (result === 'skip') {
        continue
      }

      if (!isFileEntry) {
        const shouldContinue = walk(childPath, entryRelativePath, depth + 1)
        if (!shouldContinue) {
          return false
        }
      }
    }

    return true
  }

  walk(startPath, '', 0)
}
