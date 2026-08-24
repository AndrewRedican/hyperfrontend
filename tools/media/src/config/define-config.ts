import type { MediaConfigInput } from '../models/config'

/**
 * Type a workspace configuration file without changing it.
 *
 * The value is returned untouched. What this buys is that a configuration
 * file is checked where it is written rather than where it is loaded, so a
 * misspelled key is a typecheck failure instead of a silent default.
 *
 * @param config - The workspace configuration.
 * @returns The same configuration, typed.
 */
export function defineConfig(config: MediaConfigInput): MediaConfigInput {
  return config
}
