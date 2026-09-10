import type { CapturedStill } from '../capture/record-video'
import type { MediaDefaults } from '../models/config'
import type { StillRecord } from '../models/report'
import { join } from 'node:path'
import { writeStill } from '../encode/still'
import { formatBytes } from '../lib/format-bytes'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { mergeStillOptions } from '../scene/merge-options'

/**
 * Write every still a run captured, and hold each to the budget it declared.
 *
 * Shared by both lanes because a still is the one artefact neither of them
 * disagrees about: however the frame was arrived at, what happens to it
 * afterwards is the same.
 *
 * @param captured - The stills as the page produced them.
 * @param outputDir - Absolute directory the stills are written into.
 * @param defaults - Workspace-wide encoding parameters.
 * @param slug - Directory name of the scene, used in the budget message.
 * @returns One record per written still, for the audit record.
 * @throws {Error} When a still is over the budget its scene declared.
 */
export async function writeStills(
  captured: readonly CapturedStill[],
  outputDir: string,
  defaults: MediaDefaults,
  slug: string
): Promise<readonly StillRecord[]> {
  const records: StillRecord[] = []
  for (const still of captured) {
    const asset = `${still.spec.name}.${still.spec.format ?? defaults.still.format}`
    const bytes = await writeStill(still.png, join(outputDir, asset), mergeStillOptions(defaults, still.spec))
    const maxBytes = still.spec.maxBytes ?? 0
    if (maxBytes > 0 && bytes > maxBytes) {
      throw mediaError(ExitCode.SceneFailed, `${slug}/${asset} is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} budget`)
    }
    records.push({ asset, bytes, maxBytes })
  }
  return records
}
