import type { BrowserScene, BrowserSceneInput } from '../models/scene'

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
