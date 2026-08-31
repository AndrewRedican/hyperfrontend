import type { ResolvedMediaConfig } from '../../models/config'
import type { EncoderPreference } from '../../models/encode'
import type { RunSummaryRow } from '../../models/report'
import type { ParsedArgs } from '../args'
import { mediaError } from '../../lib/media-error'
import { ExitCode } from '../../models/exit-code'
import { recordScene } from '../../pipeline/record-scene'
import { discoverScenes } from '../../scene/discover'
import { readString } from '../args'

/** Encoder names the command line accepts. */
const PREFERENCES: readonly string[] = ['auto', 'ffmpeg', 'sharp']

/**
 * Record every matching scene, one after another.
 *
 * Scenes run in sequence rather than in parallel on purpose: each one owns a
 * browser and often a server, and two recordings competing for the same
 * machine change what each of them captures.
 *
 * @param config - The workspace configuration.
 * @param args - The parsed command line.
 * @returns One row per finished scene.
 * @throws {Error} When a scene fails or its asset is over budget.
 */
export async function runRecord(config: ResolvedMediaConfig, args: ParsedArgs): Promise<readonly RunSummaryRow[]> {
  const preference = readString(args, 'encoder', '')
  if (preference !== '' && !PREFERENCES.includes(preference)) {
    throw mediaError(ExitCode.Usage, `--encoder must be one of ${PREFERENCES.join(', ')}`)
  }
  const effective: ResolvedMediaConfig =
    preference === '' ? config : { ...config, encoder: { ...config.encoder, prefer: preference as EncoderPreference } }
  const scenes = await discoverScenes(config.roots.sceneDir, readString(args, 'scene', ''))
  const rows: RunSummaryRow[] = []
  for (const loaded of scenes) {
    rows.push(await recordScene(loaded, effective, { skipBuild: args.flags.has('skip-build'), keepTmp: args.flags.has('keep-tmp') }))
  }
  return rows
}
