import type { GifOptions } from '../models/encode'
import { mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import sharpFactory from 'sharp'
import { min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { countGifFrames } from './gif-frames'

/** Colour channels each frame is read back as. */
const CHANNELS = 3

/** What an encode of a frame sequence produced. */
export interface FramesOutcome {
  /** Size of the written file. */
  bytes: number
  /** Number of frames the animation contains. */
  frames: number
}

/**
 * Turn a sequence of captured frames into a finished GIF.
 *
 * This is the half of the sharp backend that never touches a video:
 * given frames and how long each is held, it quantises and writes the
 * animation. Both lanes reach it, from opposite directions. A browser scene
 * demuxes a recording into frames and arrives with a rate it has to make the
 * best of; a scripted scene draws each frame deliberately and arrives with
 * exactly the ones it meant, which is why it needs no video, no demuxer and no
 * system binary at all.
 *
 * @param frames - The frames in order, each an encoded image or a path to one.
 * @param delaysMs - Display time of each frame, index for index.
 * @param gif - Encoding parameters for this scene.
 * @param outputPath - Absolute path the finished GIF is written to.
 * @returns What the finished file contains.
 * @throws {Error} When there are no frames to encode.
 */
export async function encodeFrames(
  frames: readonly (Buffer | string)[],
  delaysMs: readonly number[],
  gif: GifOptions,
  outputPath: string
): Promise<FramesOutcome> {
  if (frames.length === 0) {
    throw mediaError(ExitCode.SceneFailed, 'No frames were captured, so there is nothing to encode.')
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  // why: the size is read back off the resized pixels rather than the source, because `metadata` on a pipeline reports what went in rather than what came out
  const rendered = await promiseAll(
    frames.map((frame) => sharpFactory(frame).resize({ width: gif.width }).removeAlpha().raw().toBuffer({ resolveWithObject: true }))
  )
  const width = rendered[0]?.info.width ?? gif.width
  const height = rendered[0]?.info.height ?? 0
  const pixels = rendered.map((entry) => entry.data)

  await sharpFactory(Buffer.concat(pixels), { raw: { width, height: height * frames.length, channels: CHANNELS, pageHeight: height } })
    .gif({
      delay: [...delaysMs],
      loop: gif.loop,
      colours: gif.colours,
      dither: gif.dither ? 1 : 0,
      effort: 10,
      // why: lossy inter-frame merging is the only size lever this path has
      interFrameMaxError: min(32, round(gif.lossy / 10)),
    })
    .toFile(outputPath)

  return { bytes: statSync(outputPath).size, frames: await countGifFrames(outputPath) }
}
