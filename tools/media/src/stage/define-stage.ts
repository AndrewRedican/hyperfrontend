import type { Stage } from '../models/stage'

/**
 * Type a stage without changing it.
 *
 * The value is returned untouched. What this buys is that a stage is checked
 * where it is written rather than where a scene picks it up, so the
 * configuration a stage claims to take is the one a scene is held to.
 *
 * @param stage - The stage as authored.
 * @returns The same stage, typed.
 */
export function defineStage<TConfig>(stage: Stage<TConfig>): Stage<TConfig> {
  return stage
}
