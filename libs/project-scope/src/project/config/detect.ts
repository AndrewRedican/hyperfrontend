import type { ConfigPatternInfo, ConfigType } from './patterns'

import { join } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createCache } from '../../core/cache'
import { exists } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { findFiles } from '../traversal'
import { CONFIG_PATTERNS } from './patterns'

const configLogger = createScopedLogger('project-scope:config')

/**
 * Cache for config detection results.
 * TTL: 30 seconds (configs can change frequently during setup)
 */
const configDetectionCache = createCache<string, DetectedConfig[]>({ ttl: 30000, maxSize: 50 })

/**
 * Detected configuration file.
 */
export interface DetectedConfig {
  /** Config type */
  type: ConfigType
  /** File path (relative to root) */
  path: string
  /** Pattern that matched */
  matchedPattern: string
  /** Pattern info */
  info: ConfigPatternInfo
}

/**
 * Options for config detection.
 */
export interface DetectConfigOptions {
  /** Maximum depth for recursive search */
  maxDepth?: number
  /** Include hidden directories */
  includeHidden?: boolean
  /** Skip cache lookup (force fresh detection) */
  skipCache?: boolean
}

/**
 * Detect all configuration files in a directory.
 *
 * Results are cached for 30 seconds per project path and options
 * to avoid redundant file system operations on repeated calls.
 *
 * @param rootPath - Project root directory
 * @param types - Optional array of config types to check (defaults to all)
 * @param options - Detection options
 * @returns Array of detected configuration files
 *
 * @example Detecting configuration files
 * ```typescript
 * import { detectConfigs } from '@hyperfrontend/project-scope'
 *
 * // Detect all config files
 * const configs = detectConfigs('./my-project')
 * for (const config of configs) {
 *   console.log(`${config.type}: ${config.path}`)
 * }
 * // Output:
 * // typescript: tsconfig.json
 * // eslint: eslint.config.js
 * // jest: jest.config.ts
 *
 * // Detect specific config types only
 * const tsConfigs = detectConfigs('./my-project', ['typescript', 'eslint'])
 * ```
 */
export function detectConfigs(rootPath: string, types?: ConfigType[], options?: DetectConfigOptions): DetectedConfig[] {
  const typesToCheck = types ?? (keys(CONFIG_PATTERNS) as ConfigType[])
  const results: DetectedConfig[] = []
  const maxDepth = options?.maxDepth ?? 10
  const includeHidden = options?.includeHidden ?? true

  const typeKey = types ? types.sort().join(',') : 'all'
  const cacheKey = `${rootPath}:${typeKey}:${maxDepth}:${includeHidden}`

  if (!options?.skipCache) {
    const cached = configDetectionCache.get(cacheKey)
    if (cached) {
      configLogger.debug('Returning cached config detection results', { rootPath })
      return cached
    }
  }

  configLogger.debug('Detecting config files', { rootPath, types: typesToCheck.length })

  for (const type of typesToCheck) {
    const info = CONFIG_PATTERNS[type]
    if (!info) continue

    for (const pattern of info.patterns) {
      const isRecursive = pattern.includes('**')

      if (isRecursive) {
        const files = findFiles(rootPath, pattern, {
          maxDepth,
          includeHidden: options?.includeHidden ?? true,
        })

        for (const file of files) {
          if (!results.some((r) => r.path === file && r.type === type)) {
            configLogger.debug('Found config file', { type, path: file })
            results.push({
              type,
              path: file,
              matchedPattern: pattern,
              info,
            })
          }
        }
      } else {
        const fullPath = join(rootPath, pattern)
        if (exists(fullPath)) {
          if (!results.some((r) => r.path === pattern && r.type === type)) {
            configLogger.debug('Found config file', { type, path: pattern })
            results.push({
              type,
              path: pattern,
              matchedPattern: pattern,
              info,
            })
          }
        }
      }
    }
  }

  configLogger.debug('Config detection complete', { found: results.length })

  configDetectionCache.set(cacheKey, results)

  return results
}

/**
 * Clear the config detection cache.
 *
 * Useful for testing or when the project files have changed.
 *
 * @example Clearing the config detection cache
 * ```typescript
 * import { clearConfigDetectionCache } from '@hyperfrontend/project-scope'
 *
 * // Reset cache after modifying config files
 * clearConfigDetectionCache()
 * ```
 */
export function clearConfigDetectionCache(): void {
  configDetectionCache.clear()
}

/**
 * Find a specific configuration file.
 *
 * @param rootPath - Project root directory
 * @param type - Config type to find
 * @returns Full path to config file or null if not found
 *
 * @example Finding a specific config file
 * ```typescript
 * import { findConfigFile } from '@hyperfrontend/project-scope'
 *
 * const tsConfig = findConfigFile('/project', 'typescript')
 * // => '/project/tsconfig.json'
 *
 * const eslint = findConfigFile('/project', 'eslint')
 * // => '/project/.eslintrc.js' or null if not found
 * ```
 */
export function findConfigFile(rootPath: string, type: ConfigType): string | null {
  const info = CONFIG_PATTERNS[type]
  if (!info) return null

  for (const pattern of info.patterns) {
    if (!pattern.includes('*')) {
      const fullPath = join(rootPath, pattern)
      if (exists(fullPath)) {
        return fullPath
      }
    }
  }

  for (const pattern of info.patterns) {
    if (pattern.includes('*') && !pattern.includes('**')) {
      const files = findFiles(rootPath, pattern, { maxDepth: 0 })
      if (files.length > 0) {
        return join(rootPath, files[0])
      }
    }
  }

  return null
}

/**
 * Get all known config file patterns for a given configuration type.
 *
 * @param type - Configuration type identifier
 * @returns Array of glob patterns for matching config files
 *
 * @example Getting config file patterns
 * ```typescript
 * import { getConfigPaths } from '@hyperfrontend/project-scope'
 *
 * const patterns = getConfigPaths('typescript')
 * // => ['tsconfig.json', 'tsconfig.*.json']
 * ```
 */
export function getConfigPaths(type: ConfigType): string[] {
  const info = CONFIG_PATTERNS[type]
  return info?.patterns ?? []
}
