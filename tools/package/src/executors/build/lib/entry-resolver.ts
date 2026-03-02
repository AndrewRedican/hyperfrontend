import type { EntryPoint, EntryPointCategory, EntryPointDiscovery, FormatEntryConfig } from './types'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { minimatch } from 'minimatch'

/** Known platform directory names */
const PLATFORM_DIRS = <const>['browser', 'node']
type PlatformDir = (typeof PLATFORM_DIRS)[number]

/**
 * Checks if a directory name is a platform directory.
 *
 * @param name - Directory name to check
 * @returns True if the name is a known platform directory
 */
function isPlatformDir(name: string): name is PlatformDir {
  return PLATFORM_DIRS.includes(<PlatformDir>name)
}

/**
 * Checks if a directory contains an index.ts file.
 *
 * @param dirPath - Absolute path to the directory
 * @returns True if the directory contains an index.ts file
 */
function hasIndexFile(dirPath: string): boolean {
  return existsSync(join(dirPath, 'index.ts'))
}

/**
 * Gets all subdirectories of a directory.
 *
 * @param dirPath - Absolute path to the directory
 * @returns Array of subdirectory names
 */
function getSubdirectories(dirPath: string): string[] {
  if (!existsSync(dirPath)) return []

  return readdirSync(dirPath).filter((name) => {
    const fullPath = join(dirPath, name)
    return statSync(fullPath).isDirectory() && !name.startsWith('.')
  })
}

/**
 * Discovers entry points recursively within a directory.
 * Recursion continues into all subdirectories regardless of whether
 * they contain an index.ts, to find nested entry points at deeper levels.
 *
 * @param basePath - Absolute path to the base directory (e.g., src/)
 * @param relativePath - Current relative path from src/ (e.g., '', 'browser', 'browser/channel')
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Array of discovered entry points
 */
function discoverEntryPointsRecursive(basePath: string, relativePath = '', maxDepth = 3): EntryPoint[] {
  if (maxDepth <= 0) return []

  const currentPath = relativePath ? join(basePath, relativePath) : basePath
  if (!existsSync(currentPath)) return []

  const entries: EntryPoint[] = []
  const subdirs = getSubdirectories(currentPath)

  for (const subdir of subdirs) {
    const subdirPath = join(currentPath, subdir)
    const subdirRelative = relativePath ? `${relativePath}/${subdir}` : subdir

    if (hasIndexFile(subdirPath)) {
      const exportPath = `./${subdirRelative}`
      const firstSegment = subdirRelative.split('/')[0] ?? ''
      const platform = isPlatformDir(subdir) ? subdir : isPlatformDir(firstSegment) ? <PlatformDir>firstSegment : undefined

      entries.push({
        exportPath,
        srcPath: subdirRelative,
        inputFile: join(subdirPath, 'index.ts'),
        isRoot: false,
        platform,
      })
    }

    const nestedEntries = discoverEntryPointsRecursive(basePath, subdirRelative, maxDepth - 1)
    entries.push(...nestedEntries)
  }

  return entries
}

/**
 * Categorizes the entry point structure.
 *
 * @param hasRootEntry - Whether there is a root entry point
 * @param platformEntries - Platform-specific entry points
 * @param featureEntries - Feature module entry points
 * @returns The entry point category
 */
function categorizeEntryPoints(hasRootEntry: boolean, platformEntries: EntryPoint[], featureEntries: EntryPoint[]): EntryPointCategory {
  const hasPlatformEntries = platformEntries.length > 0
  const hasFeatureEntries = featureEntries.length > 0
  const hasNestedPlatformEntries = platformEntries.some((e) => e.srcPath.includes('/'))

  if (hasRootEntry && !hasPlatformEntries && !hasFeatureEntries) {
    return 'root'
  }

  if (!hasRootEntry && hasPlatformEntries && !hasFeatureEntries && !hasNestedPlatformEntries) {
    return 'platform'
  }

  if (!hasRootEntry && !hasPlatformEntries && hasFeatureEntries) {
    return 'feature'
  }

  if (hasNestedPlatformEntries) {
    return 'complex'
  }

  return 'hybrid'
}

/**
 * Discovers all entry points in a library project.
 *
 * Scans the src/ directory to find:
 * - Root entry: src/index.ts
 * - Platform entries: src/browser/index.ts, src/node/index.ts
 * - Feature entries: src/<feature>/index.ts
 * - Nested entries: src/<platform>/<feature>/index.ts, src/lib/<feature>/index.ts
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Entry point discovery result
 */
export function discoverEntryPoints(projectRoot: string): EntryPointDiscovery {
  const srcPath = join(projectRoot, 'src')
  const entryPoints: EntryPoint[] = []

  const rootIndexPath = join(srcPath, 'index.ts')
  const hasRootEntry = existsSync(rootIndexPath)

  if (hasRootEntry) {
    entryPoints.push({
      exportPath: '.',
      srcPath: '',
      inputFile: rootIndexPath,
      isRoot: true,
    })
  }

  const discoveredEntries = discoverEntryPointsRecursive(srcPath)
  entryPoints.push(...discoveredEntries)

  const platformEntries = entryPoints.filter((e) => !e.isRoot && isPlatformDir(e.srcPath.split('/')[0] ?? ''))
  const featureEntries = entryPoints.filter((e) => !e.isRoot && !isPlatformDir(e.srcPath.split('/')[0] ?? ''))

  const category = categorizeEntryPoints(hasRootEntry, platformEntries, featureEntries)

  return {
    category,
    entryPoints,
    hasRootEntry,
    platformEntries,
    featureEntries,
  }
}

/**
 * Normalizes an entry pattern to always start with './' or be '.'.
 *
 * @param pattern - Entry pattern to normalize
 * @returns Normalized pattern
 */
function normalizeEntryPattern(pattern: string): string {
  if (pattern === '.') return pattern
  if (pattern.startsWith('./')) return pattern
  return `./${pattern}`
}

/**
 * Checks if an entry point matches a pattern.
 * Supports exact paths and glob patterns.
 *
 * @param entry - Entry point to check
 * @param pattern - Pattern to match against
 * @returns True if the entry point matches the pattern
 */
function matchesPattern(entry: EntryPoint, pattern: string): boolean {
  const normalizedPattern = normalizeEntryPattern(pattern)

  if (normalizedPattern === entry.exportPath) {
    return true
  }

  if (normalizedPattern.includes('*')) {
    return minimatch(entry.exportPath, normalizedPattern)
  }

  return false
}

/**
 * Resolves entry points based on format configuration.
 *
 * @param config - Format entry configuration
 * @param discoveredEntries - All discovered entry points
 * @returns Filtered entry points matching the configuration
 */
export function resolveEntries(config: FormatEntryConfig, discoveredEntries: EntryPoint[]): EntryPoint[] {
  const entryPatterns = config.entry
  const excludePatterns = config.exclude

  let entries = discoveredEntries

  if (entryPatterns !== undefined) {
    const patterns = Array.isArray(entryPatterns) ? entryPatterns : [entryPatterns]
    entries = entries.filter((entry) => patterns.some((pattern) => matchesPattern(entry, pattern)))
  }

  if (excludePatterns !== undefined) {
    const patterns = Array.isArray(excludePatterns) ? excludePatterns : [excludePatterns]
    entries = entries.filter((entry) => !patterns.some((pattern) => matchesPattern(entry, pattern)))
  }

  return entries
}

/**
 * Gets entry points filtered by platform.
 *
 * @param discovery - Entry point discovery result
 * @param platform - Platform to filter by
 * @returns Entry points for the specified platform
 */
export function getEntryPointsByPlatform(discovery: EntryPointDiscovery, platform: 'browser' | 'node'): EntryPoint[] {
  return discovery.entryPoints.filter((e) => e.platform === platform)
}

/**
 * Gets non-platform entry points (shared/lib code and root).
 *
 * @param discovery - Entry point discovery result
 * @returns Non-platform entry points
 */
export function getSharedEntryPoints(discovery: EntryPointDiscovery): EntryPoint[] {
  return discovery.entryPoints.filter((e) => !e.platform)
}
