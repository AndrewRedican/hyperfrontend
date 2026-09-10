import type { ResolvedMediaConfig } from '../models/config'
import type { RunSummaryRow } from '../models/report'
import type { LoadedScene } from '../models/scene'
import { recordBrowserScene } from './record-browser'
import { recordScriptedScene } from './record-stage'

/** Switches a single run applies on top of what the scenes declare. */
export interface RecordOptions {
  /** Skip each scene's build command, for when the artefacts are already current. */
  skipBuild: boolean
  /** Keep the intermediates a run produces instead of deleting them. */
  keepTmp: boolean
}

/**
 * Record one scene, whichever lane it belongs to.
 *
 * The two lanes have almost nothing in common between opening a browser and
 * writing a file, so they are separate rather than one function with a mode.
 * What they do share is what they leave behind: the same asset names, the same
 * audit record and the same summary row, which is what lets `check` verify
 * either without knowing which one produced it.
 *
 * @param loaded - The scene and the file it came from.
 * @param config - The workspace configuration.
 * @param options - Switches for this run.
 * @returns What the scene produced.
 * @throws {Error} When the scene fails, or its asset is over budget.
 */
export async function recordScene(loaded: LoadedScene, config: ResolvedMediaConfig, options: RecordOptions): Promise<RunSummaryRow> {
  return loaded.scene.kind === 'browser'
    ? recordBrowserScene(loaded.filePath, loaded.scene, config, options)
    : recordScriptedScene(loaded.filePath, loaded.scene, config)
}
