import type { LoadedScene, MediaScene } from '../models/scene'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Shape a scene module arrives in once the runtime has transpiled it. */
interface SceneModule {
  /** The scene, or the scenes, the file default-exported. */
  default?: MediaScene | readonly MediaScene[]
}

/** Discriminants a scene file is allowed to carry. */
const LANES: readonly string[] = ['browser', 'scripted']

/**
 * Load one scene file and confirm it exported something the pipeline can run.
 *
 * A file usually exports one scene. A file may also export a list of them,
 * which is for the case where one table drives many near-identical scenes,
 * such as a banner per package: the alternative is one file per row of the
 * table, each saying nothing the table did not.
 *
 * @param filePath - Absolute path of the scene file.
 * @returns Each scene paired with the file it came from.
 * @throws {Error} When the file exports no scene, or one built by hand.
 */
async function loadScenes(filePath: string): Promise<readonly LoadedScene[]> {
  const loaded = (await import(pathToFileURL(filePath).href)) as SceneModule
  const exported = loaded.default
  const scenes = exported === undefined ? [] : isArray(exported) ? exported : [exported]
  if (scenes.length === 0 || scenes.some((scene) => !LANES.includes(scene.kind))) {
    throw createError(`${filePath} must default-export defineBrowserScene({ ... }), defineScriptedScene({ ... }) or a list of them`)
  }
  return scenes.map((scene) => ({ filePath, scene }))
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
  const loaded = (await promiseAll(files.map((name) => loadScenes(join(sceneDir, name))))).flat()
  const seen = createSet<string>()
  for (const entry of loaded) {
    if (seen.has(entry.scene.slug)) {
      throw createError(`Two scenes are named "${entry.scene.slug}"; the second is in ${entry.filePath}`)
    }
    seen.add(entry.scene.slug)
  }
  const matching = slug === '' ? loaded : loaded.filter((entry) => entry.scene.slug === slug)
  if (matching.length === 0) {
    throw createError(slug === '' ? `No *.scene.ts files in ${sceneDir}` : `No scene with slug "${slug}" in ${sceneDir}`)
  }
  return matching
}
