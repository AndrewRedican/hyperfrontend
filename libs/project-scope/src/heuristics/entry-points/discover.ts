import type { EntryPointInfo } from '../../models'
import { join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createCache } from '../../core/cache'
import { exists } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { readPackageJsonIfExists } from '../../project/package'
import { findFiles } from '../../project/traversal'

const entryPointLogger = createScopedLogger('project-scope:heuristics:entry-points')

/**
 * Cache for entry point discovery results.
 * TTL: 60 seconds (entry points are relatively stable)
 */
const entryPointCache = createCache<string, EntryPointInfo[]>({ ttl: 60000, maxSize: 50 })

/**
 * Supported entry point type enumeration.
 */
export type EntryPointType = 'main' | 'app' | 'server' | 'cli' | 'test'

/**
 * Entry point discovered from package.json exports/main/bin.
 */
interface PackageJsonEntrySource {
  /** Source type identifier */
  type: 'package.json'
  /** Field name in package.json (exports, main, bin) */
  field: string
}

/**
 * Entry point discovered by naming convention.
 */
interface ConventionEntrySource {
  /** Source type identifier */
  type: 'convention'
  /** File pattern that matched */
  pattern: string
}

/**
 * Entry point from framework-specific patterns.
 */
interface FrameworkEntrySource {
  /** Source type identifier */
  type: 'framework'
  /** Framework name (Next.js, Angular, etc.) */
  framework: string
}

/**
 * Entry point from build tool configuration.
 */
interface ConfigEntrySource {
  /** Source type identifier */
  type: 'config'
  /** Tool name (webpack, vite, etc.) */
  tool: string
}

/**
 * Entry point source information.
 * Describes how an entry point was discovered.
 */
export type EntryPointSource = PackageJsonEntrySource | ConventionEntrySource | FrameworkEntrySource | ConfigEntrySource

/**
 * Extended entry point info with source.
 */
export interface ExtendedEntryPointInfo extends EntryPointInfo {
  /** How the entry point was discovered */
  source: EntryPointSource
}

/**
 * Options for entry point discovery.
 */
export interface DiscoverEntryPointsOptions {
  /** Include framework-specific entries (e.g., Next.js pages) */
  includeFrameworkEntries?: boolean
  /** Maximum depth for file search */
  maxDepth?: number
  /** Skip cache lookup (force fresh detection) */
  skipCache?: boolean
}

/**
 * Common entry point patterns by project type.
 * Used for convention-based entry point discovery.
 */
export const ENTRY_POINT_PATTERNS = <const>{
  /** Library entry patterns */
  library: ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'lib/index.ts'],
  /** Application entry patterns */
  application: ['src/main.ts', 'src/main.tsx', 'main.ts', 'src/app.ts', 'app.ts'],
  /** Server entry patterns */
  server: ['src/server.ts', 'server.ts', 'src/main.ts'],
  /** CLI entry patterns */
  cli: ['src/cli.ts', 'bin/cli.ts', 'cli.ts'],
}

/**
 * Convention-based entry pattern definition.
 */
interface ConventionEntry {
  /** File path pattern to match */
  pattern: string
  /** Entry point type category */
  type: EntryPointType
  /** Detection confidence score (0-100) */
  confidence: number
}

/**
 * Convention-based entry patterns with types and confidence.
 */
const CONVENTION_ENTRIES: ConventionEntry[] = [
  { pattern: 'src/index.ts', type: 'main', confidence: 90 },
  { pattern: 'src/index.js', type: 'main', confidence: 90 },
  { pattern: 'src/main.ts', type: 'app', confidence: 85 },
  { pattern: 'src/main.tsx', type: 'app', confidence: 85 },
  { pattern: 'src/app.ts', type: 'app', confidence: 80 },
  { pattern: 'src/app.tsx', type: 'app', confidence: 80 },
  { pattern: 'src/server.ts', type: 'server', confidence: 85 },
  { pattern: 'src/server.js', type: 'server', confidence: 85 },
  { pattern: 'server.ts', type: 'server', confidence: 80 },
  { pattern: 'server.js', type: 'server', confidence: 80 },
  { pattern: 'index.ts', type: 'main', confidence: 85 },
  { pattern: 'index.js', type: 'main', confidence: 85 },
  { pattern: 'lib/index.ts', type: 'main', confidence: 80 },
  { pattern: 'lib/index.js', type: 'main', confidence: 80 },
  { pattern: 'src/cli.ts', type: 'cli', confidence: 85 },
  { pattern: 'bin/cli.ts', type: 'cli', confidence: 85 },
  { pattern: 'cli.ts', type: 'cli', confidence: 80 },
]

/**
 * Extract entry points from exports field.
 *
 * @param exports - The exports field from package.json
 * @param entryPoints - Array to add entry points to
 */
function discoverFromExports(exports: Record<string, unknown>, entryPoints: ExtendedEntryPointInfo[]): void {
  for (const [key, value] of entries(exports)) {
    if (typeof value === 'string') {
      if (!entryPoints.some((e) => e.path === value)) {
        entryPoints.push({
          path: value,
          type: 'main',
          confidence: 100,
          source: { type: 'package.json', field: `exports["${key}"]` },
        })
      }
    } else if (typeof value === 'object' && value !== null) {
      const conditions = <Record<string, unknown>>value
      const paths = [conditions['import'], conditions['require'], conditions['default'], conditions['types']].filter(
        (p): p is string => typeof p === 'string'
      )

      if (paths.length > 0) {
        const mainPath = paths[0]
        if (!entryPoints.some((e) => e.path === mainPath)) {
          entryPoints.push({
            path: mainPath,
            type: 'main',
            confidence: 100,
            source: { type: 'package.json', field: `exports["${key}"]` },
          })
        }
      }
    }
  }
}

/**
 * Discover entry points in project.
 *
 * Analyzes package.json fields (main, module, bin, exports),
 * convention-based patterns, and framework-specific entries.
 *
 * Results are cached for 60 seconds per project path and options
 * to avoid redundant file system operations on repeated calls.
 *
 * @param projectPath - Project directory path
 * @param options - Discovery options
 * @returns Array of discovered entry points sorted by confidence
 *
 * @example
 * ```typescript
 * import { discoverEntryPoints } from '@hyperfrontend/project-scope'
 *
 * const entryPoints = discoverEntryPoints('./my-app')
 * for (const entry of entryPoints) {
 *   console.log(`${entry.path} (${entry.type}) - ${entry.confidence}% confidence`)
 * }
 * // Output:
 * // src/index.ts (main) - 100% confidence
 * // src/cli.ts (cli) - 85% confidence
 * ```
 */
export function discoverEntryPoints(projectPath: string, options?: DiscoverEntryPointsOptions): EntryPointInfo[] {
  entryPointLogger.debug('Discovering entry points', { projectPath, options })

  const includeFramework = options?.includeFrameworkEntries !== false
  const maxDepth = options?.maxDepth ?? 5
  const cacheKey = `${projectPath}:${includeFramework}:${maxDepth}`

  if (!options?.skipCache) {
    const cached = entryPointCache.get(cacheKey)
    if (cached) {
      entryPointLogger.debug('Returning cached entry points', { projectPath })
      return cached
    }
  }

  const extendedEntryPoints: ExtendedEntryPointInfo[] = []
  const packageJson = readPackageJsonIfExists(projectPath)

  if (packageJson) {
    entryPointLogger.debug('Reading entry points from package.json')

    if (packageJson.main && typeof packageJson.main === 'string') {
      extendedEntryPoints.push({
        path: packageJson.main,
        type: 'main',
        confidence: 100,
        source: { type: 'package.json', field: 'main' },
      })
    }

    if (packageJson.module && typeof packageJson.module === 'string') {
      if (!extendedEntryPoints.some((e) => e.path === packageJson.module)) {
        extendedEntryPoints.push({
          path: packageJson.module,
          type: 'main',
          confidence: 100,
          source: { type: 'package.json', field: 'module' },
        })
      }
    }

    if (packageJson.browser && typeof packageJson.browser === 'string') {
      if (!extendedEntryPoints.some((e) => e.path === packageJson.browser)) {
        extendedEntryPoints.push({
          path: packageJson.browser,
          type: 'main',
          confidence: 95,
          source: { type: 'package.json', field: 'browser' },
        })
      }
    }

    if (packageJson.bin) {
      const bins: Record<string, string> =
        typeof packageJson.bin === 'string' ? { [packageJson.name ?? 'cli']: packageJson.bin } : <Record<string, string>>packageJson.bin

      for (const [name, path] of entries(bins)) {
        if (typeof path === 'string' && !extendedEntryPoints.some((e) => e.path === path)) {
          extendedEntryPoints.push({
            path,
            type: 'cli',
            confidence: 100,
            source: { type: 'package.json', field: `bin.${name}` },
          })
        }
      }
    }

    if (packageJson.exports && typeof packageJson.exports === 'object') {
      discoverFromExports(<Record<string, unknown>>packageJson.exports, extendedEntryPoints)
    }
  }

  for (const entry of CONVENTION_ENTRIES) {
    const fullPath = join(projectPath, entry.pattern)
    if (exists(fullPath)) {
      if (!extendedEntryPoints.some((e) => e.path === entry.pattern)) {
        extendedEntryPoints.push({
          path: entry.pattern,
          type: entry.type,
          confidence: entry.confidence,
          source: { type: 'convention', pattern: entry.pattern },
        })
      }
    }
  }

  if (options?.includeFrameworkEntries !== false) {
    const hasNextPages = exists(join(projectPath, 'pages')) || exists(join(projectPath, 'src', 'pages'))
    const hasNextApp = exists(join(projectPath, 'app')) || exists(join(projectPath, 'src', 'app'))

    if (hasNextPages || hasNextApp) {
      const pagesDir = exists(join(projectPath, 'pages')) ? 'pages' : 'src/pages'
      const appDir = exists(join(projectPath, 'app')) ? 'app' : 'src/app'

      if (hasNextPages) {
        const pageFiles = findFiles(projectPath, `${pagesDir}/**/*.{ts,tsx,js,jsx}`, {
          maxDepth: options?.maxDepth ?? 5,
        })
        for (const file of pageFiles.slice(0, 10)) {
          if (!file.includes('_app') && !file.includes('_document') && !file.includes('api/')) {
            extendedEntryPoints.push({
              path: file,
              type: 'app',
              confidence: 80,
              source: { type: 'framework', framework: 'nextjs' },
            })
          }
        }
      }

      if (hasNextApp) {
        const appFiles = findFiles(projectPath, `${appDir}/**/page.{ts,tsx,js,jsx}`, {
          maxDepth: options?.maxDepth ?? 5,
        })
        for (const file of appFiles.slice(0, 10)) {
          extendedEntryPoints.push({
            path: file,
            type: 'app',
            confidence: 80,
            source: { type: 'framework', framework: 'nextjs' },
          })
        }
      }
    }

    const angularMain = join(projectPath, 'src', 'main.ts')
    if (exists(angularMain) && exists(join(projectPath, 'angular.json'))) {
      if (!extendedEntryPoints.some((e) => e.path === 'src/main.ts' && e.source.type === 'framework')) {
        extendedEntryPoints.push({
          path: 'src/main.ts',
          type: 'app',
          confidence: 95,
          source: { type: 'framework', framework: 'angular' },
        })
      }
    }

    const hasSvelteRoutes = exists(join(projectPath, 'src', 'routes'))
    if (hasSvelteRoutes && exists(join(projectPath, 'svelte.config.js'))) {
      const routeFiles = findFiles(projectPath, 'src/routes/**/+page.svelte', {
        maxDepth: options?.maxDepth ?? 5,
      })
      for (const file of routeFiles.slice(0, 10)) {
        extendedEntryPoints.push({
          path: file,
          type: 'app',
          confidence: 80,
          source: { type: 'framework', framework: 'sveltekit' },
        })
      }
    }
  }

  extendedEntryPoints.sort((a, b) => b.confidence - a.confidence)

  entryPointLogger.debug('Entry point discovery complete', {
    projectPath,
    totalFound: extendedEntryPoints.length,
    bySource: {
      packageJson: extendedEntryPoints.filter((e) => e.source.type === 'package.json').length,
      convention: extendedEntryPoints.filter((e) => e.source.type === 'convention').length,
      framework: extendedEntryPoints.filter((e) => e.source.type === 'framework').length,
    },
  })

  const result = extendedEntryPoints.map((e) => ({
    path: e.path,
    type: e.type,
    confidence: e.confidence,
  }))

  entryPointCache.set(cacheKey, result)

  return result
}

/**
 * Clear the entry point discovery cache.
 *
 * Useful for testing or when the project files have changed.
 */
export function clearEntryPointCache(): void {
  entryPointCache.clear()
}
