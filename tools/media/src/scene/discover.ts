import type { BrowserScene, LoadedScene } from '../models/scene'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/** Shape a scene module arrives in once the runtime has transpiled it. */
interface SceneModule {
  /** The scene the file default-exported. */
  default?: BrowserScene
}

/**
 * Load one scene file and confirm it exported something the pipeline can run.
 *
 * @param filePath - Absolute path of the scene file.
 * @returns The scene paired with the file it came from.
 * @throws {Error} When the file exports no scene, or one built by hand.
 */
async function loadScene(filePath: string): Promise<LoadedScene> {
  const loaded = (await import(pathToFileURL(filePath).href)) as SceneModule
  const scene = loaded.default
  if (scene === undefined || scene.kind !== 'browser') {
    throw createError(`${filePath} must default-export defineBrowserScene({ ... })`)
  }
  return { filePath, scene }
}

/**
 * Load every scene in a directory, optionally narrowed to one slug.
 *
 * Scenes are returned in filename order so a run's summary reads the same way
 * twice, which matters more than it sounds when comparing two runs by eye.
 *
 * @param sceneDir - Absolute directory holding the scene files.
 * @param slug - A single scene to keep, or an empty string to keep them all.
 * @returns Every matching scene.
 * @throws {Error} When the directory is missing or the slug matches nothing.
 */
export async function discoverScenes(sceneDir: string, slug: string): Promise<readonly LoadedScene[]> {
  if (!existsSync(sceneDir)) {
    throw createError(`No scene directory at ${sceneDir}`)
  }
  const files = readdirSync(sceneDir)
    .filter((name) => name.endsWith('.scene.ts'))
    .sort()
  const loaded = await promiseAll(files.map((name) => loadScene(join(sceneDir, name))))
  const matching = slug === '' ? loaded : loaded.filter((entry) => entry.scene.slug === slug)
  if (matching.length === 0) {
    throw createError(slug === '' ? `No *.scene.ts files in ${sceneDir}` : `No scene with slug "${slug}" in ${sceneDir}`)
  }
  return matching
}
