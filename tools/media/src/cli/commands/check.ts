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
    const assetName = `${scene.asset ?? 'hero'}.gif`
    const assetPath = join(config.roots.outputDir, scene.slug, assetName)
    const sidecarPath = join(config.roots.outputDir, scene.slug, `${scene.asset ?? 'hero'}.json`)
    if (!existsSync(assetPath)) {
      issues.push({ slug: scene.slug, reason: `${assetName} is missing. Run: nx media tool-media --scene=${scene.slug}` })
      continue
    }
    const sidecar = readSidecar(sidecarPath)
    if (sidecar === undefined) {
      issues.push({
        slug: scene.slug,
        reason: `no readable audit record beside ${assetName}. Run: nx media tool-media --scene=${scene.slug}`,
      })
      continue
    }
    const bytes = statSync(assetPath).size
    const maxBytes = mergeGifOptions(config.defaults, scene.gif).maxBytes
    if (bytes > maxBytes) {
      issues.push({ slug: scene.slug, reason: `${assetName} is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} budget` })
    }
    if (bytes !== sidecar.bytes) {
      issues.push({
        slug: scene.slug,
        reason: `${assetName} is ${formatBytes(bytes)} but its audit record says ${formatBytes(sidecar.bytes)}`,
      })
    }
    if (hashScene(filePath) !== sidecar.sceneHash) {
      issues.push({
        slug: scene.slug,
        reason: `the scene changed since ${assetName} was produced. Run: nx media tool-media --scene=${scene.slug}`,
      })
    }
  }
  return { checked: scenes.length, issues }
}
