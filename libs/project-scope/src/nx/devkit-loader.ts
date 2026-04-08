import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createScopedLogger } from '../core/logger'

const devkitLogger = createScopedLogger('project-scope:nx:devkit')

/**
 * Type alias for the `@nx/devkit` module.
 */
export type NxDevkit = typeof import('@nx/devkit')

/**
 * Result of attempting to load `@nx/devkit`.
 */
export interface DevkitLoadResult {
  /** Whether `@nx/devkit` is available */
  available: boolean
  /** The loaded `@nx/devkit` module (if available) */
  devkit?: NxDevkit
  /** Error encountered during loading (if not available) */
  error?: Error
}

/** Cached load result to avoid repeated require attempts */
let cachedResult: DevkitLoadResult | null = null

/**
 * Try to load `@nx/devkit` at runtime.
 * Uses dynamic require to avoid bundling `@nx/devkit` into our output.
 * Results are cached for subsequent calls.
 *
 * @returns DevkitLoadResult with availability status and devkit module or error
 *
 * @example
 * ```typescript
 * import { tryLoadDevkit } from '@hyperfrontend/project-scope'
 *
 * const result = tryLoadDevkit()
 * if (result.available) {
 *   const tree = result.devkit.createTree()
 * }
 * ```
 */
export function tryLoadDevkit(): DevkitLoadResult {
  if (cachedResult !== null) {
    devkitLogger.debug('Returning cached devkit result', { available: cachedResult.available })
    return cachedResult
  }

  devkitLogger.debug('Attempting to load @nx/devkit')
  try {
    const devkit = require('@nx/devkit')
    devkitLogger.debug('@nx/devkit loaded successfully')
    cachedResult = { available: true, devkit }
  } catch (error) {
    devkitLogger.debug('@nx/devkit not available', { error: error instanceof Error ? error.message : String(error) })
    cachedResult = {
      available: false,
      error: error instanceof Error ? error : createError(String(error)),
    }
  }

  return cachedResult
}

/**
 * Check if `@nx/devkit` is available.
 *
 * @returns true if devkit can be loaded, false otherwise
 *
 * @example
 * ```typescript
 * import { isDevkitAvailable } from '@hyperfrontend/project-scope'
 *
 * if (isDevkitAvailable()) {
 *   // Use full NX devkit features
 * } else {
 *   // Fall back to standalone mode
 * }
 * ```
 */
export function isDevkitAvailable(): boolean {
  return tryLoadDevkit().available
}

/**
 * Get `@nx/devkit` module if available.
 * Throws if not available.
 *
 * @returns The `@nx/devkit` module with full type information
 * @throws {Error} If `@nx/devkit` is not available
 *
 * @example
 * ```typescript
 * import { getDevkit } from '@hyperfrontend/project-scope'
 *
 * const devkit = getDevkit()
 * const projects = devkit.getProjects(tree)
 * ```
 */
export function getDevkit(): NxDevkit {
  const result = tryLoadDevkit()

  if (!result.available) {
    throw createError('@nx/devkit is not available. Install it as a dependency or use standalone mode.')
  }

  return <NxDevkit>result.devkit
}

/**
 * Execute function with `@nx/devkit` if available, otherwise execute fallback.
 * This pattern allows graceful degradation when `@nx/devkit` is not installed.
 *
 * @param ifAvailable - Function to execute if `@nx/devkit` is available
 * @param fallback - Function to execute if `@nx/devkit` is not available
 * @returns Result from whichever function was executed
 *
 * @example
 * ```typescript
 * const tree = withDevkit(
 *   (devkit) => devkit.createTree(),
 *   () => new FsTree(process.cwd())
 * )
 * ```
 */
export function withDevkit<T>(ifAvailable: (devkit: NxDevkit) => T, fallback: () => T): T {
  const result = tryLoadDevkit()

  if (result.available && result.devkit) {
    return ifAvailable(result.devkit)
  }

  return fallback()
}

/**
 * Reset the cached devkit load result.
 * Primarily useful for testing.
 *
 * @internal
 *
 * @example
 * ```typescript
 * import { resetDevkitCache } from '@hyperfrontend/project-scope'
 *
 * // In test teardown
 * resetDevkitCache()
 * ```
 */
export function resetDevkitCache(): void {
  cachedResult = null
}
