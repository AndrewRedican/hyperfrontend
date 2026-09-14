import type { ResolvedMediaConfig } from '../../models/config'
import type { ThemeId } from '../../models/theme'
import type { ParsedArgs } from '../args'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import sharpFactory from 'sharp'
import { ceil, floor, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { launchBrowser } from '../../browser/launch'
import { openSession } from '../../browser/session'
import { capturePng } from '../../capture/screenshot'
import { formatBytes } from '../../lib/format-bytes'
import { mediaError } from '../../lib/media-error'
import { ExitCode } from '../../models/exit-code'
import { discoverScenes } from '../../scene/discover'
import { stageDocument } from '../../stage/document'
import { mountFrame } from '../../stage/mount'
import { resolveProfile } from '../../stage/profiles'
import { resolveTheme } from '../../theme/resolve'
import { listThemes } from '../../theme/themes'
import { readString } from '../args'
import { readMoments } from '../moments'

/** Margin around a frame on the contact sheet, in CSS pixels. */
const SHEET_PAD = 16

/** Columns the contact sheet is laid out in. */
const SHEET_COLUMNS = 2

/**
 * Read the theme to draw off the command line.
 *
 * @param args - The parsed command line.
 * @returns The theme's name.
 * @throws {Error} When the name is not a built-in theme's.
 */
function readTheme(args: ParsedArgs): ThemeId {
  const names = listThemes().map((theme) => theme.id)
  const wanted = readString(args, 'theme', 'portable')
  const found = names.find((name) => name === wanted)
  if (found === undefined) {
    throw mediaError(ExitCode.Usage, `--theme must be one of ${names.join(', ')}`)
  }
  return found
}

/**
 * Draw chosen instants of one scripted scene onto a contact sheet.
 *
 * The scene polish loop is the reason this exists. Recording a scene in every
 * variant takes minutes; asking for four moments of one variant takes seconds,
 * and a sheet of them answers the questions a recording would be asked:
 * whether a line wraps, whether a column overflows, whether the caption lands
 * on top of a row. A portable frame is composited onto the background asked
 * for, white by default, because a transparent frame on its own shows nothing
 * about how it will sit on a page.
 *
 * @param config - The workspace configuration.
 * @param args - The parsed command line.
 * @returns A line saying where the sheet was written.
 * @throws {Error} When the scene is not scripted, or an argument is malformed.
 */
export async function runPreview(config: ResolvedMediaConfig, args: ParsedArgs): Promise<string> {
  const slug = readString(args, 'scene', '')
  if (slug === '') {
    throw mediaError(ExitCode.Usage, 'preview needs --scene')
  }
  const outputPath = readString(args, 'out', '')
  if (outputPath === '') {
    throw mediaError(ExitCode.Usage, 'preview needs --out')
  }
  const themeName = readTheme(args)
  const background = readString(args, 'background', '#ffffff')

  const [loaded] = await discoverScenes(config.roots.sceneDir, slug)
  if (loaded === undefined || loaded.scene.kind !== 'scripted') {
    throw mediaError(ExitCode.Usage, `${slug} is not a scripted scene; preview draws stages, not applications`)
  }
  const scene = loaded.scene
  const profile = resolveProfile(scene.profile)
  const theme = resolveTheme(themeName, scene.hue, scene.themeOverrides)
  const durationMs = scene.durationMs(profile)
  const moments = readMoments(readString(args, 'at', '0'), durationMs)

  const launched = await launchBrowser(config.browser)
  try {
    const session = await openSession(launched.browser, {
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.scale,
      videoDir: '',
      url: '',
      readyTimeoutMs: config.browser.readyTimeoutMs,
    })
    await session.page.setContent(stageDocument(scene.styles(profile, theme), profile, theme), { waitUntil: 'load' })
    const frames: Buffer[] = []
    for (const atMs of moments) {
      await mountFrame(session.page, scene.frame(profile, theme, min(atMs, durationMs)))
      frames.push(await capturePng(session.page, { omitBackground: theme.transparent }))
    }
    await session.context.close()

    const width = profile.width * profile.scale
    const height = profile.height * profile.scale
    const pad = SHEET_PAD * profile.scale
    const rows = ceil(frames.length / SHEET_COLUMNS)
    const columns = min(SHEET_COLUMNS, frames.length)
    mkdirSync(dirname(outputPath), { recursive: true })
    const written = await sharpFactory({
      create: { width: columns * (width + pad) + pad, height: rows * (height + pad) + pad, channels: 4, background },
    })
      .composite(
        frames.map((input, index) => ({
          input,
          left: pad + (index % SHEET_COLUMNS) * (width + pad),
          top: pad + floor(index / SHEET_COLUMNS) * (height + pad),
        }))
      )
      .png()
      .toFile(outputPath)
    return `${outputPath}  ${formatBytes(written.size)}  ${frames.length} frames of ${slug} (${themeName}), timeline ${durationMs}ms`
  } finally {
    await launched.browser.close()
  }
}
