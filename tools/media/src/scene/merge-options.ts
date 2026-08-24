import type { MediaDefaults } from '../models/config'
import type { GifOptions, StillOptions } from '../models/encode'
import type { StillSpec } from '../models/scene'

/**
 * Fill a scene's GIF parameters from the workspace defaults.
 *
 * @param defaults - Workspace-wide encoding parameters.
 * @param overrides - What this scene stated for itself.
 * @returns Fully specified GIF parameters.
 */
export function mergeGifOptions(defaults: MediaDefaults, overrides: Partial<GifOptions> | undefined): GifOptions {
  return { ...defaults.gif, ...overrides }
}

/**
 * Fill one still's parameters from the workspace defaults.
 *
 * @param defaults - Workspace-wide encoding parameters.
 * @param still - The still as declared on the scene.
 * @returns Fully specified still parameters.
 */
export function mergeStillOptions(defaults: MediaDefaults, still: StillSpec): StillOptions {
  return {
    format: still.format ?? defaults.still.format,
    quality: still.quality ?? defaults.still.quality,
    width: still.width ?? defaults.still.width,
  }
}
