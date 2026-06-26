import { join } from 'node:path'
import { exists } from '@hyperfrontend/project-scope/core/fs'

// note: Resolution order — JSON first, then JS, then TS.
const CONFIG_EXTENSIONS: readonly string[] = ['.json', '.js', '.mjs', '.cjs', '.ts', '.cts', '.mts']

/** Base name (no extension) of the feature config file. */
export const FEATURE_CONFIG_BASENAME = 'feature.config'

/** Base name (no extension) of the dev-server config file. */
export const DEV_CONFIG_BASENAME = 'hf-dev.config'

/**
 * Finds the first `<baseName>.<ext>` config file directly under a directory.
 *
 * Extensions are probed in the loader's documented order (JSON, then JS, then
 * TS) so a single project never has its format silently chosen at random.
 *
 * @param directory - Directory to search (typically the CLI's working directory).
 * @param baseName - Config base name, e.g. {@link FEATURE_CONFIG_BASENAME}.
 * @returns The absolute path of the first match, or `null` when none exists.
 *
 * @example Discovering a feature config in the current directory
 * ```typescript
 * const path = discoverConfigFile(process.cwd(), FEATURE_CONFIG_BASENAME)
 * ```
 */
export function discoverConfigFile(directory: string, baseName: string): string | null {
  for (const extension of CONFIG_EXTENSIONS) {
    const candidate = join(directory, `${baseName}${extension}`)
    if (exists(candidate)) {
      return candidate
    }
  }
  return null
}
