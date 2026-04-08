import type { RepositoryConfig } from './repository-config'

/**
 * How to resolve repository information for compare URLs.
 *
 * - `explicit`: Use only the provided `RepositoryConfig`; error if missing
 * - `inferred`: Auto-detect from package.json repository field or git remote
 * - `disabled`: Do not generate compare URLs (default for backward compatibility)
 */
export type RepositoryResolutionMode = 'explicit' | 'inferred' | 'disabled'

/**
 * Sources for repository inference, in order of preference.
 *
 * - `package-json`: Read from `repository` field in package.json
 * - `git-remote`: Read from `git remote get-url origin`
 */
export type RepositoryInferenceSource = 'package-json' | 'git-remote'

/**
 * Full repository resolution configuration.
 *
 * Provides fine-grained control over repository resolution behavior.
 *
 * @example
 * ```typescript
 * // Explicit configuration - must provide repository
 * const explicit: RepositoryResolution = {
 *   mode: 'explicit',
 *   repository: {
 *     platform: 'github',
 *     baseUrl: 'https://github.com/owner/repo'
 *   }
 * }
 *
 * // Auto-detection with custom order
 * const inferred: RepositoryResolution = {
 *   mode: 'inferred',
 *   inferenceOrder: ['git-remote', 'package-json']  // Try git first
 * }
 *
 * // Disabled
 * const disabled: RepositoryResolution = {
 *   mode: 'disabled'
 * }
 * ```
 */
export interface RepositoryResolution {
  /**
   * Resolution mode.
   */
  readonly mode: RepositoryResolutionMode

  /**
   * Explicit repository config.
   *
   * Required when `mode` is `'explicit'`.
   * Ignored when `mode` is `'inferred'` or `'disabled'`.
   */
  readonly repository?: RepositoryConfig

  /**
   * Inference source order when `mode` is `'inferred'`.
   *
   * Sources are tried in order until one succeeds.
   * Default: `['package-json', 'git-remote']`
   */
  readonly inferenceOrder?: readonly RepositoryInferenceSource[]
}

/**
 * Creates a disabled repository resolution configuration.
 *
 * No compare URLs will be generated.
 *
 * @returns A RepositoryResolution with mode 'disabled'
 *
 * @example
 * ```typescript
 * const config = createDisabledResolution()
 * // { mode: 'disabled' }
 * ```
 */
export function createDisabledResolution(): RepositoryResolution {
  return { mode: 'disabled' }
}

/**
 * Creates an explicit repository resolution configuration.
 *
 * @param repository - The repository config to use
 * @returns A RepositoryResolution with mode 'explicit'
 *
 * @example
 * ```typescript
 * const config = createExplicitResolution({
 *   platform: 'github',
 *   baseUrl: 'https://github.com/owner/repo'
 * })
 * ```
 */
export function createExplicitResolution(repository: RepositoryConfig): RepositoryResolution {
  return {
    mode: 'explicit',
    repository,
  }
}

/**
 * Creates an inferred repository resolution configuration.
 *
 * @param inferenceOrder - Order to try inference sources (default: package-json first)
 * @returns A RepositoryResolution with mode 'inferred'
 *
 * @example
 * ```typescript
 * // Default order: package.json → git remote
 * const config = createInferredResolution()
 *
 * // Custom order: git remote → package.json
 * const customOrder = createInferredResolution(['git-remote', 'package-json'])
 * ```
 */
export function createInferredResolution(
  inferenceOrder: readonly RepositoryInferenceSource[] = ['package-json', 'git-remote']
): RepositoryResolution {
  return {
    mode: 'inferred',
    inferenceOrder,
  }
}

/**
 * Checks if a value is a RepositoryResolution object.
 *
 * @param value - Value to check
 * @returns True if the value is a RepositoryResolution
 *
 * @example
 * ```typescript
 * import { isRepositoryResolution } from '@hyperfrontend/versioning'
 *
 * const config = loadConfig()
 * if (isRepositoryResolution(config.repository)) {
 *   console.log('Repository mode:', config.repository.mode)
 * }
 * ```
 */
export function isRepositoryResolution(value: unknown): value is RepositoryResolution {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = <Record<string, unknown>>value
  const mode = obj['mode']

  return mode === 'explicit' || mode === 'inferred' || mode === 'disabled'
}

/**
 * Default inference order when mode is 'inferred'.
 */
export const DEFAULT_INFERENCE_ORDER: readonly RepositoryInferenceSource[] = ['package-json', 'git-remote']
