import type { Browser } from 'playwright-core'
import type { ResolvedMediaConfig, VariantSpec } from '../models/config'
import type { AssetSidecar, RunSummaryRow, StillRecord, VariantRecord } from '../models/report'
import type { ScriptedScene } from '../models/scene'
import { join } from 'node:path'
import sharpFactory from 'sharp'
import { launchBrowser } from '../browser/launch'
import { openSession } from '../browser/session'
import { assertWithinBudget } from '../encode/budget'
import { encodeFrames } from '../encode/frames'
import { logger } from '../lib/logger'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { hashScene, nowIso, writeSidecar } from '../report/sidecar'
import { playStage } from '../stage/play'
import { resolveProfile } from '../stage/profiles'
import { resolveTheme } from '../theme/resolve'
import { suffixStills, variantGifOptions, variantsFor } from './variants'
import { writeStills } from './write-stills'

/** What rendering one variant left behind, and whether the page complained while it was drawn. */
interface RenderedVariant {
  /** The variant's entry in the audit record. */
  record: VariantRecord
  /** Uncaught errors the page threw while the stage was drawn. */
  pageErrors: number
}

/**
 * Render one variant of a scene and leave its files on disk.
 *
 * @param browser - The browser every variant shares.
 * @param scene - The scene being recorded.
 * @param variant - The variant to render.
 * @param config - The workspace configuration.
 * @param outputDir - Absolute directory the scene's assets are written under.
 * @returns What the variant produced, and the console record of its session.
 * @throws {Error} When the stage throws, or the animation cannot be brought under budget.
 */
async function renderVariant(
  browser: Browser,
  scene: ScriptedScene,
  variant: VariantSpec,
  config: ResolvedMediaConfig,
  outputDir: string
): Promise<RenderedVariant> {
  const assetName = scene.asset ?? 'hero'
  const profile = resolveProfile(scene.profile)
  const theme = resolveTheme(variant.theme, scene.hue, scene.themeOverrides)
  const gif = variantGifOptions(config.defaults, scene, variant, profile)
  const session = await openSession(browser, {
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.scale,
    videoDir: '',
    url: '',
    readyTimeoutMs: config.browser.readyTimeoutMs,
  })
  const played = await playStage(session.page, scene, profile, theme, suffixStills(scene.stills ?? [], variant.suffix))
  await session.context.close()
  if (session.consoleRecord.pageErrors > 0) {
    return { record: { theme: variant.theme }, pageErrors: session.consoleRecord.pageErrors }
  }

  const animated = scene.outputs.includes('gif')
  const asset = `${assetName}${variant.suffix}.gif`
  const outcome = animated
    ? await encodeFrames(played.frames, played.delaysMs, gif, join(outputDir, asset), { transparent: theme.transparent, optimise: true })
    : undefined
  if (outcome !== undefined) {
    assertWithinBudget(`${scene.slug} (${variant.theme})`, outcome.bytes, gif.maxBytes)
    for (const compromise of outcome.compromises) {
      logger.warn(`${scene.slug} (${variant.theme}): ${compromise}`)
    }
  }
  const stills: readonly StillRecord[] = await writeStills(played.stills, outputDir, config.defaults, scene.slug)
  return {
    pageErrors: 0,
    record: {
      theme: variant.theme,
      ...(outcome === undefined
        ? {}
        : {
            asset,
            bytes: outcome.bytes,
            maxBytes: gif.maxBytes,
            frames: outcome.frames,
            gif: outcome.applied,
            compromises: outcome.compromises,
          }),
      ...(stills.length === 0 ? {} : { stills }),
    },
  }
}

/**
 * Record one scripted scene end to end and leave its assets on disk.
 *
 * Almost nothing this lane does is timing-sensitive, which is the point of it.
 * There is no server to start, no application to wait for, no clock to pin and
 * no video to trim: the stage is asked for each frame in turn and photographed
 * before the next one is asked for, so what lands is decided entirely by the
 * scene file and not at all by the machine that ran it.
 *
 * One scene becomes one file per configured variant. The variants share every
 * frame's timing, layout and content and differ only in the theme they were
 * drawn with; the first variant is the one the audit record describes at its
 * top level, so anything reading the record for one asset reads the one under
 * the bare name.
 *
 * @param filePath - Absolute path of the scene file, digested into the record.
 * @param scene - The scene to record.
 * @param config - The workspace configuration.
 * @returns What the scene produced.
 * @throws {Error} When the stage errors, or a variant is over budget.
 */
export async function recordScriptedScene(filePath: string, scene: ScriptedScene, config: ResolvedMediaConfig): Promise<RunSummaryRow> {
  const startedAt = performance.now()
  const assetName = scene.asset ?? 'hero'
  const profile = resolveProfile(scene.profile)
  const outputDir = join(config.roots.outputDir, scene.slug)
  const variants = variantsFor(scene, config)

  const launched = await launchBrowser(config.browser)
  try {
    const records: VariantRecord[] = []
    for (const variant of variants) {
      const { record, pageErrors } = await renderVariant(launched.browser, scene, variant, config, outputDir)
      if (pageErrors > 0) {
        throw mediaError(
          ExitCode.SceneFailed,
          `The ${scene.stageId} stage threw while drawing ${scene.slug} (${variant.theme}). Run with --verbose to see it.`
        )
      }
      records.push(record)
    }
    const primary = records[0]
    if (primary === undefined) {
      throw mediaError(ExitCode.SceneFailed, `${scene.slug} has no variants to render.`)
    }
    const primaryAsset = primary.asset ?? primary.stills?.[0]?.asset ?? `${assetName}.png`
    const totalBytes = records.reduce(
      (sum, record) => sum + (record.bytes ?? 0) + (record.stills ?? []).reduce((inner, still) => inner + still.bytes, 0),
      0
    )

    const sidecar: AssetSidecar = {
      slug: scene.slug,
      asset: primaryAsset,
      generatedAt: nowIso(),
      sceneHash: hashScene(filePath),
      sourceUrl: `stage:${scene.stageId}`,
      profile,
      viewport: { width: profile.width, height: profile.height },
      record: { settleMs: 0, durationMs: scene.durationMs(profile) },
      startMs: 0,
      ...(primary.gif === undefined
        ? {}
        : {
            gif: primary.gif,
            encoder: 'sharp' as const,
            toolVersions: [{ name: 'sharp', version: sharpFactory.versions.vips }],
            bytes: primary.bytes,
            frames: primary.frames,
          }),
      ...(primary.stills === undefined ? {} : { stills: primary.stills }),
      variants: records,
      browser: { name: 'chromium', version: launched.browser.version(), executablePath: launched.executablePath },
      determinism: {},
      console: { errors: 0, warnings: 0, pageErrors: 0 },
    }
    writeSidecar(join(outputDir, `${assetName}.json`), sidecar)

    return {
      slug: scene.slug,
      asset: primaryAsset,
      bytes: primary.bytes ?? totalBytes,
      maxBytes: primary.maxBytes ?? 0,
      frames: primary.frames ?? 0,
      ...(primary.gif === undefined ? {} : { encoder: 'sharp' as const }),
      variants: records.length,
      elapsedMs: performance.now() - startedAt,
    }
  } finally {
    await launched.browser.close()
  }
}
