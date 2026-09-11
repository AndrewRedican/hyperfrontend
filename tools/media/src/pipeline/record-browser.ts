import type { ResolvedMediaConfig } from '../models/config'
import type { AssetSidecar, RunSummaryRow } from '../models/report'
import type { BrowserScene } from '../models/scene'
import type { ServerHandle } from '../serve/run-command'
import type { RecordOptions } from './record-scene'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { assertScene } from '../browser/assertions'
import { launchBrowser } from '../browser/launch'
import { openSession } from '../browser/session'
import { recordWindow } from '../capture/record-video'
import { encodeGif } from '../encode/gif'
import { hashScene, nowIso, writeSidecar } from '../report/sidecar'
import { mergeGifOptions } from '../scene/merge-options'
import { startServer } from '../serve/run-command'
import { writeStills } from './write-stills'

/**
 * Record one browser scene end to end and leave its assets on disk.
 *
 * Everything the scene needs is torn down on the way out whether it succeeded
 * or not, because a leaked server holds a port and the next run allocates a
 * different one and looks like it worked.
 *
 * @param filePath - Absolute path of the scene file, digested into the record.
 * @param scene - The scene to record.
 * @param config - The workspace configuration.
 * @param options - Switches for this run.
 * @returns What the scene produced.
 * @throws {Error} When the page never becomes ready, or the asset is over budget.
 */
export async function recordBrowserScene(
  filePath: string,
  scene: BrowserScene,
  config: ResolvedMediaConfig,
  options: RecordOptions
): Promise<RunSummaryRow> {
  const startedAt = performance.now()
  const assetName = scene.asset ?? 'hero'
  // why: the outputs list is what decides whether a video is recorded at all, so a scene that only wants a still never pays for one it would throw away
  const animated = scene.outputs.includes('gif')
  const gif = mergeGifOptions(config.defaults, scene.gif)
  const sceneTmp = join(config.roots.tmpDir, scene.slug)
  const outputDir = join(config.roots.outputDir, scene.slug)
  rmSync(sceneTmp, { recursive: true, force: true })
  mkdirSync(sceneTmp, { recursive: true })

  let server: ServerHandle | undefined
  const launched = await launchBrowser(config.browser)
  try {
    if (scene.serve !== undefined) {
      server = await startServer(options.skipBuild ? { ...scene.serve, build: undefined } : scene.serve, config.roots.rootDir)
    }
    const url = scene.page?.url ?? `${server?.origin ?? ''}${scene.page?.path ?? '/'}`
    const session = await openSession(launched.browser, {
      viewport: scene.viewport,
      videoDir: animated ? join(sceneTmp, 'video') : '',
      determinism: scene.determinism,
      url,
      ready: scene.ready,
      readyTimeoutMs: config.browser.readyTimeoutMs,
    })
    await assertScene(session.page, scene.assert, session.consoleRecord)

    const recorded = await recordWindow(session, scene.record, scene.stills ?? [], scene.choreograph)
    const outcome =
      recorded.path === undefined
        ? undefined
        : await encodeGif(
            {
              sourcePath: recorded.path,
              outputPath: join(outputDir, `${assetName}.gif`),
              scratchDir: join(sceneTmp, 'encode'),
              startMs: recorded.startMs,
              durationMs: recorded.durationMs,
              gif,
            },
            config.encoder,
            scene.slug
          )
    const stills = await writeStills(recorded.stills, outputDir, config.defaults, scene.slug)
    // why: a still-only scene's record is named for the asset it actually produced, so `check` can find it without knowing which lane wrote it
    const primary = outcome === undefined ? (stills[0]?.asset ?? `${assetName}.png`) : `${assetName}.gif`

    const sidecar: AssetSidecar = {
      slug: scene.slug,
      asset: primary,
      generatedAt: nowIso(),
      sceneHash: hashScene(filePath),
      sourceUrl: url,
      viewport: scene.viewport,
      record: scene.record,
      startMs: recorded.startMs,
      ...(outcome === undefined
        ? {}
        : { gif, encoder: outcome.encoder, toolVersions: outcome.toolVersions, bytes: outcome.bytes, frames: outcome.frames }),
      ...(stills.length === 0 ? {} : { stills }),
      browser: { name: 'chromium', version: launched.browser.version(), executablePath: launched.executablePath },
      determinism: scene.determinism ?? {},
      console: session.consoleRecord,
    }
    writeSidecar(join(outputDir, `${assetName}.json`), sidecar)

    return {
      slug: scene.slug,
      asset: primary,
      bytes: outcome?.bytes ?? stills.reduce((total, still) => total + still.bytes, 0),
      maxBytes: outcome === undefined ? 0 : gif.maxBytes,
      frames: outcome?.frames ?? 0,
      ...(outcome === undefined ? {} : { encoder: outcome.encoder }),
      elapsedMs: performance.now() - startedAt,
    }
  } finally {
    server?.stop()
    await launched.browser.close()
    if (!options.keepTmp) {
      rmSync(sceneTmp, { recursive: true, force: true })
    }
  }
}
