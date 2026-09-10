import type { EncoderBinaries, GifBackend, GifEncodeOutcome, GifEncodeRequest, ToolVersion } from '../../models/encode'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharpFactory from 'sharp'
import { mediaError } from '../../lib/media-error'
import { ExitCode } from '../../models/exit-code'
import { readVersion, resolveFrameFfmpeg } from '../binaries'
import { planFrames } from '../decimate'
import { encodeFrames } from '../frames'

/**
 * Turn the recorded video into one PNG per source frame.
 *
 * Frames are scaled here rather than later because the bundled ffmpeg build
 * that ships with the browsers can scale but cannot resample the frame rate,
 * and scaling first keeps the intermediate directory small.
 *
 * @param request - The encode being prepared.
 * @param ffmpegPath - The ffmpeg build to demux with.
 * @returns Absolute paths of the extracted frames, in order.
 * @throws {Error} When extraction produces nothing.
 */
function extractFrames(request: GifEncodeRequest, ffmpegPath: string): readonly string[] {
  const framesDir = join(request.scratchDir, 'frames')
  mkdirSync(framesDir, { recursive: true })
  try {
    execFileSync(
      ffmpegPath,
      [
        '-v',
        'error',
        '-y',
        '-ss',
        `${request.startMs / 1000}`,
        '-t',
        `${request.durationMs / 1000}`,
        '-i',
        request.sourcePath,
        '-vf',
        `scale=${request.gif.width}:-1`,
        join(framesDir, 'f%05d.png'),
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    )
  } catch (cause) {
    throw mediaError(ExitCode.SceneFailed, `Frame extraction failed: ${cause instanceof Error ? cause.message : `${cause}`}`)
  }
  const frames = readdirSync(framesDir)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => join(framesDir, name))
  if (frames.length === 0) {
    throw mediaError(ExitCode.SceneFailed, `No frames were extracted from ${request.sourcePath}`)
  }
  return frames
}

/**
 * Encode a GIF entirely inside libvips, with no system binaries.
 *
 * Slower and larger than the ffmpeg path on full-frame motion, and the only
 * path that works on a machine where nothing has been installed.
 */
export const sharpBackend: GifBackend = {
  name: 'sharp',

  isAvailable(binaries: EncoderBinaries): boolean {
    return resolveFrameFfmpeg(binaries.ffmpeg) !== ''
  },

  async encode(request: GifEncodeRequest, binaries: EncoderBinaries): Promise<GifEncodeOutcome> {
    const ffmpegPath = resolveFrameFfmpeg(binaries.ffmpeg)
    if (ffmpegPath === '') {
      throw mediaError(
        ExitCode.ToolchainMissing,
        'No ffmpeg found. Install ffmpeg, or run `npx playwright install chromium` to get the bundled build.'
      )
    }
    const frames = extractFrames(request, ffmpegPath)
    const plan = planFrames(frames.length, request.durationMs, request.gif.fps)
    const outcome = await encodeFrames(
      plan.indexes.map((index) => frames[index] ?? ''),
      plan.delaysMs,
      request.gif,
      request.outputPath
    )

    const toolVersions: readonly ToolVersion[] = [
      { name: 'sharp', version: sharpFactory.versions.vips },
      { name: 'ffmpeg', version: readVersion(ffmpegPath, '-version') },
    ]
    return { bytes: outcome.bytes, frames: outcome.frames, encoder: 'sharp', toolVersions }
  },
}
