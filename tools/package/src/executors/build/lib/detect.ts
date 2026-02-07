/**
 * Library entry point detection for the build executor.
 *
 * Dynamically discovers entry points by scanning the project's src/ directory.
 * Supports various patterns: root, platform-specific, feature-based, and complex nested structures.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { EntryPoint, EntryPointCategory, EntryPointDiscovery } from './types'

/** Known platform directory names */
const PLATFORM_DIRS = ['browser', 'node'] as const
type PlatformDir = (typeof PLATFORM_DIRS)[number]

/**
 * Checks if a directory name is a platform directory.
 *
 * @param name - Directory name to check
 * @returns True if the name is a known platform directory
 */
function isPlatformDir(name: string): name is PlatformDir {
  return PLATFORM_DIRS.includes(name as PlatformDir)
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
 *
 * @param basePath - Absolute path to the base directory (e.g., src/)
 * @param relativePath - Current relative path from src/ (e.g., '', 'browser', 'browser/channel')
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Array of discovered entry points
 */
function discoverEntryPointsRecursive(
  basePath: string,
  relativePath = '',
  maxDepth = 3
): EntryPoint[] {
  if (maxDepth <= 0) return []

  const currentPath = relativePath ? join(basePath, relativePath) : basePath
  if (!existsSync(currentPath)) return []

  const entries: EntryPoint[] = []
  const subdirs = getSubdirectories(currentPath)

  for (const subdir of subdirs) {
    const subdirPath = join(currentPath, subdir)
    const subdirRelative = relativePath ? `${relativePath}/${subdir}` : subdir

    // Check if this directory has an index.ts (is an entry point)
    if (hasIndexFile(subdirPath)) {
      const exportPath = `./${subdirRelative}`
      const firstSegment = subdirRelative.split('/')[0] ?? ''
      const platform = isPlatformDir(subdir)
        ? subdir
        : isPlatformDir(firstSegment)
          ? (firstSegment as PlatformDir)
          : undefined

      entries.push({
        exportPath,
        srcPath: subdirRelative,
        inputFile: join(subdirPath, 'index.ts'),
        isRoot: false,
        platform,
      })
    }

    // Always recurse into subdirectories to find nested entry points
    // (e.g., browser/ might not have index.ts but browser/channel/ does)
    const nestedEntries = discoverEntryPointsRecursive(basePath, subdirRelative, maxDepth - 1)
    entries.push(...nestedEntries)
  }

  return entries
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

  // Check for root entry point
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

  // Discover all other entry points
  const discoveredEntries = discoverEntryPointsRecursive(srcPath)
  entryPoints.push(...discoveredEntries)

  // Categorize entries
  const platformEntries = entryPoints.filter(
    (e) => !e.isRoot && isPlatformDir(e.srcPath.split('/')[0] ?? '')
  )
  const featureEntries = entryPoints.filter(
    (e) => !e.isRoot && !isPlatformDir(e.srcPath.split('/')[0] ?? '')
  )

  // Determine category
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
 * Categorizes the entry point structure.
 *
 * @param hasRootEntry - Whether there is a root entry point
 * @param platformEntries - Platform-specific entry points
 * @param featureEntries - Feature module entry points
 * @returns The entry point category
 */
function categorizeEntryPoints(
  hasRootEntry: boolean,
  platformEntries: EntryPoint[],
  featureEntries: EntryPoint[]
): EntryPointCategory {
  const hasPlatformEntries = platformEntries.length > 0
  const hasFeatureEntries = featureEntries.length > 0
  const hasNestedPlatformEntries = platformEntries.some((e) => e.srcPath.includes('/'))

  // Root only
  if (hasRootEntry && !hasPlatformEntries && !hasFeatureEntries) {
    return 'root'
  }

  // Platform only (browser/node at top level)
  if (!hasRootEntry && hasPlatformEntries && !hasFeatureEntries && !hasNestedPlatformEntries) {
    return 'platform'
  }

  // Feature only (multiple features, no platform split)
  if (!hasRootEntry && !hasPlatformEntries && hasFeatureEntries) {
    return 'feature'
  }

  // Complex (nested platform+feature like network-protocol)
  if (hasNestedPlatformEntries) {
    return 'complex'
  }

  // Hybrid (mix of root + platform, root + features, or platform + non-platform features)
  return 'hybrid'
}

/**
 * Gets entry points filtered by platform.
 *
 * @param discovery - Entry point discovery result
 * @param platform - Platform to filter by
 * @returns Entry points for the specified platform
 */
export function getEntryPointsByPlatform(
  discovery: EntryPointDiscovery,
  platform: 'browser' | 'node'
): EntryPoint[] {
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
