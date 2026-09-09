import type { ResolvedMediaConfig } from '../../models/config'
import type { CheckIssue, CheckOutcome } from '../../models/report'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatBytes } from '../../lib/format-bytes'
import { hashScene, readSidecar } from '../../report/sidecar'
import { discoverScenes } from '../../scene/discover'
import { mergeGifOptions } from '../../scene/merge-options'

/**
 * Verify committed assets against the scenes that produced them.
 *
 * Deliberately does not record anything. Two runs of the same scene produce
 * different bytes, so an asset can never be verified by regenerating it and
 * comparing; what can be verified is that the file is present, within its
 * budget, and was produced from the scene as it stands today. That makes this
 * the one part of the pipeline safe to run anywhere, with no browser and no
 * encoder installed.
 *
 * @param config - The workspace configuration.
 * @param slug - A single scene to check, or an empty string for all of them.
 * @returns What was checked and everything that is wrong.
 */
export async function runCheck(config: ResolvedMediaConfig, slug: string): Promise<CheckOutcome> {
  const scenes = await discoverScenes(config.roots.sceneDir, slug)
  const issues: CheckIssue[] = []
  for (const { filePath, scene } of scenes) {
    const stem = scene.asset ?? 'hero'
    const animated = scene.outputs.includes('gif')
    const sceneDir = join(config.roots.outputDir, scene.slug)
    const sidecarPath = join(sceneDir, `${stem}.json`)
    const rerun = `Run: nx media tool-media --scene=${scene.slug}`
    // why: a scene that emits no animation has no gif to look for, and its record names the still it wrote instead
    const assetName = animated ? `${stem}.gif` : undefined
    if (assetName !== undefined && !existsSync(join(sceneDir, assetName))) {
      issues.push({ slug: scene.slug, reason: `${assetName} is missing. ${rerun}` })
      continue
    }
    const sidecar = readSidecar(sidecarPath)
    if (sidecar === undefined) {
      issues.push({ slug: scene.slug, reason: `no readable audit record for ${scene.slug}. ${rerun}` })
      continue
    }
    if (assetName !== undefined) {
      const bytes = statSync(join(sceneDir, assetName)).size
      const maxBytes = mergeGifOptions(config.defaults, scene.gif).maxBytes
      if (bytes > maxBytes) {
        issues.push({ slug: scene.slug, reason: `${assetName} is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} budget` })
      }
      if (bytes !== sidecar.bytes) {
        issues.push({
          slug: scene.slug,
          reason: `${assetName} is ${formatBytes(bytes)} but its audit record says ${formatBytes(sidecar.bytes ?? 0)}`,
        })
      }
    }
    for (const still of sidecar.stills ?? []) {
      const stillPath = join(sceneDir, still.asset)
      if (!existsSync(stillPath)) {
        issues.push({ slug: scene.slug, reason: `${still.asset} is missing. ${rerun}` })
        continue
      }
      const bytes = statSync(stillPath).size
      if (still.maxBytes > 0 && bytes > still.maxBytes) {
        issues.push({ slug: scene.slug, reason: `${still.asset} is ${formatBytes(bytes)}, over the ${formatBytes(still.maxBytes)} budget` })
      }
      if (bytes !== still.bytes) {
        // note: exact counts rather than rounded ones, because the two sizes are usually close enough to print identically
        issues.push({ slug: scene.slug, reason: `${still.asset} is ${bytes} bytes but its audit record says ${still.bytes}` })
      }
    }
    if (hashScene(filePath) !== sidecar.sceneHash) {
      issues.push({ slug: scene.slug, reason: `the scene changed since ${sidecar.asset} was produced. ${rerun}` })
    }
  }
  return { checked: scenes.length, issues }
}
