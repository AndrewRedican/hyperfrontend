import type { EncoderBinaries, GifBackend, GifEncodeOutcome, GifEncodeRequest, ToolVersion } from '../../models/encode'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mediaError } from '../../lib/media-error'
import { ExitCode } from '../../models/exit-code'
import { commandAvailable, readVersion } from '../binaries'
import { countGifFrames } from '../gif-frames'

/**
 * Run a binary and turn a failure into a message that names the command.
 *
 * @param command - Binary to invoke.
 * @param args - Arguments passed to it.
 * @throws {Error} When the command exits non-zero, carrying its own diagnostics.
 */
function run(command: string, args: readonly string[]): void {
  try {
    execFileSync(command, [...args], { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (cause) {
    throw mediaError(ExitCode.SceneFailed, `${command} failed: ${cause instanceof Error ? cause.message : `${cause}`}`)
  }
}

/**
 * Build the filter chain shared by the palette and the encode pass.
 *
 * @param request - The encode being prepared.
 * @returns An ffmpeg filter chain.
 */
function scaleChain(request: GifEncodeRequest): string {
  return `fps=${request.gif.fps},scale=${request.gif.width}:-1:flags=lanczos`
}

/**
 * Encode a GIF with ffmpeg's two-pass palette, then shrink it with gifsicle.
 *
 * A palette generated from the clip's own colours, in `diff` mode so it favours
 * the pixels that actually change, is what makes this backend markedly smaller
 * than a generic quantiser on scenes where the whole frame is in motion.
 */
export const ffmpegBackend: GifBackend = {
  name: 'ffmpeg',

  isAvailable(binaries: EncoderBinaries): boolean {
    return commandAvailable(binaries.ffmpeg, '-version')
  },

  async encode(request: GifEncodeRequest, binaries: EncoderBinaries): Promise<GifEncodeOutcome> {
    mkdirSync(request.scratchDir, { recursive: true })
    const palettePath = join(request.scratchDir, 'palette.png')
    const rawPath = join(request.scratchDir, 'raw.gif')
    const seek = ['-ss', `${request.startMs / 1000}`, '-t', `${request.durationMs / 1000}`]
    const dither = request.gif.dither ? 'dither=bayer:bayer_scale=3' : 'dither=none'

    run(binaries.ffmpeg, [
      '-v',
      'error',
      '-y',
      ...seek,
      '-i',
      request.sourcePath,
      '-vf',
      `${scaleChain(request)},palettegen=max_colors=${request.gif.colours}:stats_mode=diff`,
      palettePath,
    ])
    run(binaries.ffmpeg, [
      '-v',
      'error',
      '-y',
      ...seek,
      '-i',
      request.sourcePath,
      '-i',
      palettePath,
      '-lavfi',
      `${scaleChain(request)}[x];[x][1:v]paletteuse=${dither}:diff_mode=rectangle`,
      '-loop',
      `${request.gif.loop}`,
      rawPath,
    ])

    const toolVersions: ToolVersion[] = [{ name: 'ffmpeg', version: readVersion(binaries.ffmpeg, '-version') }]
    if (commandAvailable(binaries.gifsicle, '--version')) {
      const lossy = request.gif.lossy > 0 ? [`--lossy=${request.gif.lossy}`] : []
      run(binaries.gifsicle, ['-O3', ...lossy, rawPath, '-o', request.outputPath])
      toolVersions.push({ name: 'gifsicle', version: readVersion(binaries.gifsicle, '--version') })
    } else {
      copyFileSync(rawPath, request.outputPath)
    }

    return {
      bytes: statSync(request.outputPath).size,
      frames: await countGifFrames(request.outputPath),
      encoder: 'ffmpeg',
      toolVersions,
    }
  },
}
