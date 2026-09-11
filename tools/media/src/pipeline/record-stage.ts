import type { ResolvedMediaConfig } from '../models/config'
import type { AssetSidecar, RunSummaryRow } from '../models/report'
import type { ScriptedScene } from '../models/scene'
import { join } from 'node:path'
import sharpFactory from 'sharp'
import { launchBrowser } from '../browser/launch'
import { openSession } from '../browser/session'
import { assertWithinBudget } from '../encode/budget'
import { encodeFrames } from '../encode/frames'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { hashScene, nowIso, writeSidecar } from '../report/sidecar'
import { mergeGifOptions } from '../scene/merge-options'
import { playStage } from '../stage/play'
import { resolveProfile } from '../stage/profiles'
import { writeStills } from './write-stills'

/**
 * Record one scripted scene end to end and leave its assets on disk.
 *
 * Almost nothing this lane does is timing-sensitive, which is the point of it.
 * There is no server to start, no application to wait for, no clock to pin and
 * no video to trim: the stage is asked for each frame in turn and photographed
 * before the next one is asked for, so what lands is decided entirely by the
 * scene file and not at all by the machine that ran it.
 *
 * @param filePath - Absolute path of the scene file, digested into the record.
 * @param scene - The scene to record.
 * @param config - The workspace configuration.
 * @returns What the scene produced.
 * @throws {Error} When the stage errors, or the asset is over budget.
 */
export async function recordScriptedScene(filePath: string, scene: ScriptedScene, config: ResolvedMediaConfig): Promise<RunSummaryRow> {
  const startedAt = performance.now()
  const assetName = scene.asset ?? 'hero'
  const animated = scene.outputs.includes('gif')
  const profile = resolveProfile(scene.profile)
  // why: a scene composed against a profile has already decided how wide its asset is, so the workspace default would only ever resample it away from that
  const gif = { ...mergeGifOptions(config.defaults, scene.gif), width: scene.gif?.width ?? profile.width }
  const outputDir = join(config.roots.outputDir, scene.slug)

  const launched = await launchBrowser(config.browser)
  try {
    const session = await openSession(launched.browser, {
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.scale,
      videoDir: '',
      url: '',
      readyTimeoutMs: config.browser.readyTimeoutMs,
    })
    const played = await playStage(session.page, scene, profile, scene.stills ?? [])
    if (session.consoleRecord.pageErrors > 0) {
      throw mediaError(ExitCode.SceneFailed, `The ${scene.stageId} stage threw while drawing ${scene.slug}. Run with --verbose to see it.`)
    }
    const durationMs = scene.durationMs(profile)
    const outcome = animated ? await encodeFrames(played.frames, played.delaysMs, gif, join(outputDir, `${assetName}.gif`)) : undefined
    if (outcome !== undefined) {
      assertWithinBudget(scene.slug, outcome.bytes, gif.maxBytes)
    }
    const stills = await writeStills(played.stills, outputDir, config.defaults, scene.slug)
    const primary = outcome === undefined ? (stills[0]?.asset ?? `${assetName}.png`) : `${assetName}.gif`

    const sidecar: AssetSidecar = {
      slug: scene.slug,
      asset: primary,
      generatedAt: nowIso(),
      sceneHash: hashScene(filePath),
      sourceUrl: `stage:${scene.stageId}`,
      profile,
      viewport: { width: profile.width, height: profile.height },
      record: { settleMs: 0, durationMs },
      startMs: 0,
      ...(outcome === undefined
        ? {}
        : {
            gif,
            encoder: 'sharp' as const,
            toolVersions: [{ name: 'sharp', version: sharpFactory.versions.vips }],
            bytes: outcome.bytes,
            frames: outcome.frames,
          }),
      ...(stills.length === 0 ? {} : { stills }),
      browser: { name: 'chromium', version: launched.browser.version(), executablePath: launched.executablePath },
      determinism: {},
      console: session.consoleRecord,
    }
    writeSidecar(join(outputDir, `${assetName}.json`), sidecar)

    return {
      slug: scene.slug,
      asset: primary,
      bytes: outcome?.bytes ?? stills.reduce((total, still) => total + still.bytes, 0),
      maxBytes: outcome === undefined ? 0 : gif.maxBytes,
      frames: outcome?.frames ?? 0,
      ...(outcome === undefined ? {} : { encoder: 'sharp' as const }),
      elapsedMs: performance.now() - startedAt,
    }
  } finally {
    await launched.browser.close()
  }
}
