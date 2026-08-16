import type { SeaPlatform } from '../../models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Inputs to {@link resolveHostBinary}.
 */
export interface ResolveHostBinaryInputs {
  /** Target platform identifier (`<platform>-<arch>`). */
  platform: SeaPlatform
  /** Override for the path of the current Node executable; defaults to `process.execPath`. */
  currentExecPath?: string
  /** Override for the current platform identifier; defaults to `<process.platform>-<process.arch>`. */
  currentPlatform?: string
}

/**
 * Resolves the path of the Node host binary that will be cloned and have the
 * SEA blob injected into it.
 *
 * The resolver is current-platform-only: the host binary is always
 * `process.execPath`. Cross-platform builds are orchestrated by an external
 * CI matrix where each runner produces the binary for its own platform.
 *
 * Calling this function with a target platform that doesn't match the current
 * host throws: the caller is expected to gate via {@link currentPlatformMatches}
 * before invoking the SEA pipeline. The throw exists as a defense-in-depth
 * check should that gate be bypassed.
 *
 * @param inputs - Target platform and optional current-host overrides for testability.
 * @returns Absolute path to a Node host binary suitable as a postject template.
 * @throws {Error} When the requested platform doesn't match the current process platform.
 *
 * @example Resolving the host for the current runner
 * ```typescript
 * const host = resolveHostBinary({ platform: 'linux-x64' }) // process.execPath
 * ```
 */
export const resolveHostBinary = (inputs: ResolveHostBinaryInputs): string => {
  const currentPlatform = inputs.currentPlatform ?? `${process.platform}-${process.arch}`
  if (inputs.platform !== currentPlatform) {
    throw createError(
      `Cannot resolve host binary for ${inputs.platform}: only the current platform (${currentPlatform}) is supported. Run on a matching CI runner.`
    )
  }
  return inputs.currentExecPath ?? process.execPath
}
