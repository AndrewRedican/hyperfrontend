import type { MediaDefaults, ResolvedMediaConfig, VariantSpec } from '../models/config'
import type { GifOptions } from '../models/encode'
import type { MediaProfile } from '../models/profile'
import type { ScriptedScene, StillSpec } from '../models/scene'
import type { ThemeId } from '../models/theme'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { mergeGifOptions } from '../scene/merge-options'

/**
 * The themes a scene asks for that the workspace does not configure.
 *
 * @param scene - The scene being examined.
 * @param config - The workspace configuration.
 * @returns Each theme the scene names with no variant to carry it, in the scene's order.
 */
export function unconfiguredThemes(scene: ScriptedScene, config: ResolvedMediaConfig): readonly ThemeId[] {
  const configured = config.variants.map((variant) => variant.theme)
  return (scene.themes ?? []).filter((theme) => !configured.includes(theme))
}

/**
 * The variants a scene is rendered as.
 *
 * Every configured variant unless the scene names a subset, and then the
 * configured ones it named, in the order the workspace configures them rather
 * than the order the scene listed them, so the first variant is always the
 * one the audit record describes at its top level.
 *
 * @param scene - The scene being recorded.
 * @param config - The workspace configuration.
 * @returns The variants to render, in configured order.
 * @throws {Error} When the scene names a theme the workspace does not configure.
 */
export function variantsFor(scene: ScriptedScene, config: ResolvedMediaConfig): readonly VariantSpec[] {
  const missing = unconfiguredThemes(scene, config)
  if (missing.length > 0) {
    throw mediaError(
      ExitCode.SceneFailed,
      `${scene.slug} asks for the ${missing.join(', ')} theme${missing.length === 1 ? '' : 's'} but the workspace configures only ${config.variants.map((variant) => variant.theme).join(', ')}`
    )
  }
  const wanted = scene.themes
  const chosen = wanted === undefined ? config.variants : config.variants.filter((variant) => wanted.includes(variant.theme))
  if (chosen.length === 0) {
    throw mediaError(ExitCode.SceneFailed, `${scene.slug} names no themes, so there is nothing to render it as`)
  }
  return chosen
}

/**
 * The encoding parameters one variant of a scene is held to.
 *
 * Workspace defaults under the scene's own, then the variant's, and finally
 * the two values a profile decides: a scene composed against a profile has
 * already chosen how wide its asset is and how often it is sampled, so a
 * default there would only ever resample it away from that.
 *
 * @param defaults - Workspace-wide encoding parameters.
 * @param scene - The scene being recorded.
 * @param variant - The variant being rendered.
 * @param profile - The profile the scene is composed against.
 * @returns Fully specified GIF parameters for this variant.
 */
export function variantGifOptions(defaults: MediaDefaults, scene: ScriptedScene, variant: VariantSpec, profile: MediaProfile): GifOptions {
  return {
    ...mergeGifOptions(defaults, scene.gif),
    ...variant.gif,
    width: scene.gif?.width ?? profile.width,
    fps: scene.fps ?? profile.fps,
  }
}

/**
 * Give every still the suffix of the variant it belongs to.
 *
 * @param stills - The stills as the scene declared them.
 * @param suffix - The variant's suffix, such as `.dark`.
 * @returns The same stills, named for the variant.
 */
export function suffixStills(stills: readonly StillSpec[], suffix: string): readonly StillSpec[] {
  return stills.map((still) => ({ ...still, name: `${still.name}${suffix}` }))
}
