import type { EncoderConfig } from '../models/config'
import type { GifBackend } from '../models/encode'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { ffmpegBackend } from './backends/ffmpeg'
import { sharpBackend } from './backends/sharp'

/**
 * Pick the GIF backend a run will use.
 *
 * `auto` prefers ffmpeg because it produces markedly smaller files on scenes
 * where the whole frame is in motion, and falls back to sharp so a machine
 * with nothing installed still produces an asset rather than an error. An
 * explicit choice is honoured even when the other backend would be better,
 * because a workspace comparing two encodes needs to be able to pin one.
 *
 * @param encoder - The workspace's encoder configuration.
 * @returns The backend that will run.
 * @throws {Error} When the requested backend cannot run here.
 */
export function resolveBackend(encoder: EncoderConfig): GifBackend {
  if (encoder.prefer === 'ffmpeg' || encoder.prefer === 'sharp') {
    const chosen = encoder.prefer === 'ffmpeg' ? ffmpegBackend : sharpBackend
    if (!chosen.isAvailable(encoder.binaries)) {
      throw mediaError(
        ExitCode.ToolchainMissing,
        `The ${chosen.name} encoder was requested but is not available. Run the doctor command to see what is missing.`
      )
    }
    return chosen
  }
  if (ffmpegBackend.isAvailable(encoder.binaries)) {
    return ffmpegBackend
  }
  if (sharpBackend.isAvailable(encoder.binaries)) {
    return sharpBackend
  }
  throw mediaError(
    ExitCode.ToolchainMissing,
    'No GIF encoder is available. Install ffmpeg, or run `npx playwright install chromium` to get the bundled build.'
  )
}
