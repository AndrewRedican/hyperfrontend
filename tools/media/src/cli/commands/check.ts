import type { ResolvedMediaConfig } from '../../models/config'
import type { AssetSidecar, CheckIssue, CheckOutcome, StillRecord } from '../../models/report'
import type { ScriptedScene } from '../../models/scene'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatBytes } from '../../lib/format-bytes'
import { unconfiguredThemes, variantGifOptions, variantsFor } from '../../pipeline/variants'
import { hashScene, readSidecar } from '../../report/sidecar'
import { discoverScenes } from '../../scene/discover'
import { mergeGifOptions } from '../../scene/merge-options'
import { resolveProfile } from '../../stage/profiles'

/**
 * Verify one animation against what its record claims and what its scene allows.
 *
 * @param sceneDir - Absolute directory the scene's assets sit in.
 * @param slug - Directory name of the scene, for the report.
 * @param asset - Filename of the animation.
 * @param recordedBytes - Size the audit record claims.
 * @param maxBytes - Size ceiling the scene declares.
 * @param rerun - The command that regenerates the scene.
 * @returns Every problem found with this one file.
 */
function checkAnimation(
  sceneDir: string,
  slug: string,
  asset: string,
  recordedBytes: number,
  maxBytes: number,
  rerun: string
): CheckIssue[] {
  const filePath = join(sceneDir, asset)
  if (!existsSync(filePath)) {
    return [{ slug, reason: `${asset} is missing. ${rerun}` }]
  }
  const issues: CheckIssue[] = []
  const bytes = statSync(filePath).size
  if (bytes > maxBytes) {
    issues.push({ slug, reason: `${asset} is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} budget` })
  }
  if (bytes !== recordedBytes) {
    issues.push({ slug, reason: `${asset} is ${formatBytes(bytes)} but its audit record says ${formatBytes(recordedBytes)}` })
  }
  return issues
}

/**
 * Verify every still a record names.
 *
 * @param sceneDir - Absolute directory the scene's assets sit in.
 * @param slug - Directory name of the scene, for the report.
 * @param stills - The stills the record claims were written.
 * @param rerun - The command that regenerates the scene.
 * @returns Every problem found.
 */
function checkStills(sceneDir: string, slug: string, stills: readonly StillRecord[], rerun: string): CheckIssue[] {
  const issues: CheckIssue[] = []
  for (const still of stills) {
    const stillPath = join(sceneDir, still.asset)
    if (!existsSync(stillPath)) {
      issues.push({ slug, reason: `${still.asset} is missing. ${rerun}` })
      continue
    }
    const bytes = statSync(stillPath).size
    if (still.maxBytes > 0 && bytes > still.maxBytes) {
      issues.push({ slug, reason: `${still.asset} is ${formatBytes(bytes)}, over the ${formatBytes(still.maxBytes)} budget` })
    }
    if (bytes !== still.bytes) {
      // note: exact counts rather than rounded ones, because the two sizes are usually close enough to print identically
      issues.push({ slug, reason: `${still.asset} is ${bytes} bytes but its audit record says ${still.bytes}` })
    }
  }
  return issues
}

/**
 * Verify every variant a scripted scene is meant to have.
 *
 * The variants come from the configuration rather than from the record, so a
 * theme added to the workspace since the scene was last recorded is reported
 * as missing rather than silently absent; and each variant's budget is the one
 * the configuration states today, not the one the record remembers.
 *
 * @param scene - The scene being checked.
 * @param sidecar - The audit record beside its assets.
 * @param config - The workspace configuration.
 * @param sceneDir - Absolute directory the scene's assets sit in.
 * @param rerun - The command that regenerates the scene.
 * @returns Every problem found across the variants.
 */
function checkVariants(
  scene: ScriptedScene,
  sidecar: AssetSidecar,
  config: ResolvedMediaConfig,
  sceneDir: string,
  rerun: string
): CheckIssue[] {
  const missing = unconfiguredThemes(scene, config)
  if (missing.length > 0) {
    return missing.map((theme) => ({ slug: scene.slug, reason: `asks for the ${theme} theme, which the workspace does not configure` }))
  }
  if (scene.themes?.length === 0) {
    return [{ slug: scene.slug, reason: 'names no themes, so there is nothing to record it as' }]
  }
  const issues: CheckIssue[] = []
  const animated = scene.outputs.includes('gif')
  const profile = resolveProfile(scene.profile)
  const recorded = sidecar.variants ?? []
  for (const variant of variantsFor(scene, config)) {
    const record = recorded.find((candidate) => candidate.theme === variant.theme)
    if (record === undefined) {
      issues.push({ slug: scene.slug, reason: `no ${variant.theme} variant was recorded. ${rerun}` })
      continue
    }
    if (animated) {
      const maxBytes = variantGifOptions(config.defaults, scene, variant, profile).maxBytes
      issues.push(
        ...(record.asset === undefined
          ? [{ slug: scene.slug, reason: `the ${variant.theme} variant was recorded without its animation. ${rerun}` }]
          : checkAnimation(sceneDir, scene.slug, record.asset, record.bytes ?? 0, maxBytes, rerun))
      )
    }
    issues.push(...checkStills(sceneDir, scene.slug, record.stills ?? [], rerun))
  }
  return issues
}

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
 * A scripted scene is checked once per variant the workspace configures for
 * it, so a theme whose file went missing or grew past its own budget is
 * reported by name.
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
    const sceneDir = join(config.roots.outputDir, scene.slug)
    const rerun = `Run: nx media tool-media --scene=${scene.slug}`
    const sidecar = readSidecar(join(sceneDir, `${stem}.json`))
    if (sidecar === undefined) {
      issues.push({ slug: scene.slug, reason: `no readable audit record for ${scene.slug}. ${rerun}` })
      continue
    }

    if (scene.kind === 'scripted') {
      issues.push(...checkVariants(scene, sidecar, config, sceneDir, rerun))
    } else {
      // why: a scene that emits no animation has no gif to look for, and its record names the still it wrote instead
      if (scene.outputs.includes('gif')) {
        const maxBytes = mergeGifOptions(config.defaults, scene.gif).maxBytes
        issues.push(...checkAnimation(sceneDir, scene.slug, `${stem}.gif`, sidecar.bytes ?? 0, maxBytes, rerun))
      }
      issues.push(...checkStills(sceneDir, scene.slug, sidecar.stills ?? [], rerun))
    }

    if (hashScene(filePath) !== sidecar.sceneHash) {
      issues.push({ slug: scene.slug, reason: `the scene changed since ${sidecar.asset} was produced. ${rerun}` })
    }
  }
  return { checked: scenes.length, issues }
}
