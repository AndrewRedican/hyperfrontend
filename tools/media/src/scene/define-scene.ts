import type { BrowserScene, BrowserSceneInput, ScriptedScene, ScriptedSceneInput } from '../models/scene'

/**
 * Type a browser scene and stamp it with the lane that runs it.
 *
 * The discriminant is added here rather than written in the scene file so a
 * scene cannot claim to be something the pipeline will not run.
 *
 * @param scene - The scene as authored.
 * @returns The same scene, marked as a browser scene.
 */
export function defineBrowserScene(scene: BrowserSceneInput): BrowserScene {
  return { ...scene, kind: 'browser' }
}

/**
 * Type a scripted scene, bind its stage to its configuration, and stamp the
 * lane that runs it.
 *
 * Binding happens here because this is the one place that knows both halves.
 * The scene file states a stage and the configuration that stage expects, and
 * the two are checked against each other on the spot; what leaves is three
 * closures that need only a profile and a moment, so nothing downstream carries
 * a type parameter it has no use for.
 *
 * @param scene - The scene as authored.
 * @returns The same scene, bound and marked as a scripted scene.
 */
export function defineScriptedScene<TConfig>(scene: ScriptedSceneInput<TConfig>): ScriptedScene {
  const { stage, config, ...rest } = scene
  return {
    ...rest,
    kind: 'scripted',
    stageId: stage.id,
    styles: (profile) => stage.styles(config, profile),
    durationMs: (profile) => stage.durationMs(config, profile),
    frame: (profile, atMs) => stage.frame({ config, profile, atMs }),
  }
}
