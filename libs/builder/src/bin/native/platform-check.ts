import type { SeaPlatform } from '../../models'

/**
 * Returns the target identifier for the current Node process in the form
 * `<process.platform>-<process.arch>` (e.g., `linux-x64`).
 *
 * The string is shaped to match {@link SeaPlatform} but is returned as a plain
 * string because callers commonly compare against arbitrary user-declared
 * platform lists, which may legally include values not in the supported union.
 *
 * @returns `<platform>-<arch>` for the current process.
 *
 * @example Identifying the current target
 * ```typescript
 * const target = currentPlatformTarget() // 'linux-x64'
 * ```
 */
export const currentPlatformTarget = (): string => `${process.platform}-${process.arch}`

/**
 * Returns `true` when the current Node process matches one of the declared
 * SEA target platforms — i.e., when `<process.platform>-<process.arch>` is
 * present in `declaredPlatforms`.
 *
 * Builder uses this gate to skip native emission silently on runners that
 * weren't asked to produce a binary for the current host. CI orchestrates the
 * matrix so each declared platform is built on the matching runner.
 *
 * @param declaredPlatforms - Platforms declared on the bin's `sea` config.
 * @returns Whether the current host matches any declared platform.
 *
 * @example Gating native emission to declared targets
 * ```typescript
 * if (!currentPlatformMatches(bin.sea?.platforms ?? [])) {
 *   log.info(`skipping native build for ${bin.name} on ${currentPlatformTarget()}`)
 *   return []
 * }
 * ```
 */
export const currentPlatformMatches = (declaredPlatforms: readonly SeaPlatform[]): boolean => {
  const target = currentPlatformTarget()
  for (const platform of declaredPlatforms) if (platform === target) return true
  return false
}
