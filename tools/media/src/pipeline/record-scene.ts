import type { ResolvedMediaConfig } from '../models/config'
import type { AssetSidecar, RunSummaryRow, StillRecord } from '../models/report'
import type { LoadedScene } from '../models/scene'
import type { ServerHandle } from '../serve/run-command'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { assertScene } from '../browser/assertions'
import { launchBrowser } from '../browser/launch'
import { openSession } from '../browser/session'
import { recordWindow } from '../capture/record-video'
import { encodeGif } from '../encode/gif'
import { writeStill } from '../encode/still'
import { formatBytes } from '../lib/format-bytes'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { hashScene, nowIso, writeSidecar } from '../report/sidecar'
import { mergeGifOptions, mergeStillOptions } from '../scene/merge-options'
import { startServer } from '../serve/run-command'

/** Switches a single run applies on top of what the scenes declare. */
export interface RecordOptions {
  /** Skip each scene's build command, for when the artefacts are already current. */
  skipBuild: boolean
  /** Keep the intermediates a run produces instead of deleting them. */
  keepTmp: boolean
}

/**
 * Record one scene end to end and leave its assets on disk.
 *
 * Everything the scene needs is torn down on the way out whether it succeeded
 * or not, because a leaked server holds a port and the next run allocates a
 * different one and looks like it worked.
 *
 * @param loaded - The scene and the file it came from.
 * @param config - The workspace configuration.
 * @param options - Switches for this run.
 * @returns What the scene produced.
 * @throws {Error} When the page never becomes ready, or the asset is over budget.
 */
export async function recordScene(loaded: LoadedScene, config: ResolvedMediaConfig, options: RecordOptions): Promise<RunSummaryRow> {
  const startedAt = performance.now()
  const { scene } = loaded
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
    const stills: StillRecord[] = []
    for (const still of recorded.stills) {
      const asset = `${still.spec.name}.${still.spec.format ?? config.defaults.still.format}`
      const bytes = await writeStill(still.png, join(outputDir, asset), mergeStillOptions(config.defaults, still.spec))
      const maxBytes = still.spec.maxBytes ?? 0
      if (maxBytes > 0 && bytes > maxBytes) {
        throw mediaError(ExitCode.SceneFailed, `${scene.slug}/${asset} is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} budget`)
      }
      stills.push({ asset, bytes, maxBytes })
    }
    // why: a still-only scene's record is named for the asset it actually produced, so `check` can find it without knowing which lane wrote it
    const primary = outcome === undefined ? (stills[0]?.asset ?? `${assetName}.png`) : `${assetName}.gif`

    const sidecar: AssetSidecar = {
      slug: scene.slug,
      asset: primary,
      generatedAt: nowIso(),
      sceneHash: hashScene(loaded.filePath),
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
