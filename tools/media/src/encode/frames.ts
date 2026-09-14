import type { GifOptions } from '../models/encode'
import type { FrameRun, RawFrame } from './runs'
import { mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import sharpFactory from 'sharp'
import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { formatBytes } from '../lib/format-bytes'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { countGifFrames } from './gif-frames'
import { decimate, foldDuplicates } from './runs'

/** Alpha below which a pixel of a transparent frame is left clear; a GIF has no in-between. */
const ALPHA_CUTOFF = 128

/** Most an inter-frame merge is allowed to err by, on sharp's 0 to 32 scale. */
const MAX_INTER_FRAME_ERROR = 20

/** Fewest colours an optimisation step will quantise to. */
const MIN_COLOURS = 32

/** Slowest frame rate an optimisation step will decimate to. */
const MIN_FPS = 4

/** Narrowest an optimisation step will resample a frame to, as a fraction of what was asked for. */
const MIN_WIDTH_FRACTION = 0.75

/** How much narrower each width step goes. */
const WIDTH_STEP = 0.875

/** What an encode of a frame sequence produced. */
export interface FramesOutcome {
  /** Size of the written file. */
  bytes: number
  /** Number of frames the animation contains. */
  frames: number
  /** The encoding parameters that were finally applied, after any optimisation. */
  applied: GifOptions
  /** Each compromise the optimiser made to reach the budget, in the order it made them. */
  compromises: readonly string[]
}

/** How an encode is allowed to differ from what was asked for. */
export interface EncodeFramesOptions {
  /** Whether the frames carry transparency that must reach the file. */
  transparent?: boolean
  /**
   * Whether the optimiser may trade fidelity for size when the first encode
   * is over budget.
   *
   * Off, an encode over budget simply reports its size and the caller decides.
   * On, the ladder below is walked one rung at a time and the file that lands
   * is the first one under the budget.
   */
  optimise?: boolean
}

/**
 * Snap a transparent frame's alpha to on or off, in place.
 *
 * A GIF has one transparent index and nothing between it and opaque, so an
 * anti-aliased edge over a clear canvas has to be decided pixel by pixel here
 * rather than left for the quantiser to average into a halo.
 *
 * @param data - RGBA pixels.
 */
function snapAlpha(data: Buffer): void {
  for (let index = 3; index < data.length; index += 4) {
    data[index] = (data[index] ?? 0) < ALPHA_CUTOFF ? 0 : 255
  }
}

/**
 * Decode and resample every frame once, at one width.
 *
 * @param frames - The frames in order, each an encoded image or a path to one.
 * @param width - Output width in pixels.
 * @param transparent - Whether alpha is kept.
 * @returns The frames as raw pixels.
 */
async function decodeFrames(frames: readonly (Buffer | string)[], width: number, transparent: boolean): Promise<readonly RawFrame[]> {
  // why: the size is read back off the resized pixels rather than the source, because `metadata` on a pipeline reports what went in rather than what came out
  const rendered = await promiseAll(
    frames.map((frame) => {
      const resized = sharpFactory(frame).resize({ width })
      return (transparent ? resized.ensureAlpha() : resized.removeAlpha()).raw().toBuffer({ resolveWithObject: true })
    })
  )
  return rendered.map((entry) => {
    if (transparent) {
      snapAlpha(entry.data)
    }
    return { data: entry.data, width: entry.info.width, height: entry.info.height }
  })
}

/**
 * Write one GIF from raw frames.
 *
 * @param frames - The frames in order, all the same size.
 * @param delaysMs - Display time of each frame, index for index.
 * @param gif - Encoding parameters.
 * @param transparent - Whether the frames carry alpha.
 * @param outputPath - Absolute path the finished GIF is written to.
 * @returns Size of the written file.
 */
async function writeGif(
  frames: readonly RawFrame[],
  delaysMs: readonly number[],
  gif: GifOptions,
  transparent: boolean,
  outputPath: string
): Promise<number> {
  const first = frames[0]
  if (first === undefined) {
    throw mediaError(ExitCode.SceneFailed, 'No frames were captured, so there is nothing to encode.')
  }
  const channels = transparent ? 4 : 3
  await sharpFactory(Buffer.concat(frames.map((frame) => frame.data)), {
    raw: { width: first.width, height: first.height * frames.length, channels, pageHeight: first.height },
  })
    .gif({
      delay: [...delaysMs],
      loop: gif.loop,
      colours: gif.colours,
      dither: gif.dither ? 1 : 0,
      effort: 10,
      // why: lossy inter-frame merging is the size lever this path has; the scene's gifsicle-scale figure is mapped onto sharp's
      interFrameMaxError: min(MAX_INTER_FRAME_ERROR, round(gif.lossy / 10)),
    })
    .toFile(outputPath)
  return statSync(outputPath).size
}

/** One rung of the optimisation ladder: what it changes, and how to say so. */
interface Rung {
  /** Whether this rung can still be climbed from the given parameters. */
  applies: (gif: GifOptions) => boolean
  /** The parameters after this rung. */
  step: (gif: GifOptions) => GifOptions
  /** A sentence for the audit record. */
  describe: (before: GifOptions, after: GifOptions) => string
}

/**
 * The compromises the optimiser is prepared to make, cheapest first.
 *
 * The order is the priority the assets are held to: legibility before motion
 * before size. Merging near-identical pixels between frames costs nothing a
 * reader can see on a flat interface and little on a moving one, so it is
 * taken in three steps before anything else gives. A smaller palette costs a
 * gradient before it costs a word. Halving the frame rate costs smoothness,
 * which on full-frame motion is the thing a reader notices first, so it comes
 * after every merging step; and only then is the frame itself allowed to
 * shrink, because a narrower frame is a smaller typeface everywhere.
 */
const LADDER: readonly Rung[] = [
  {
    applies: (gif) => round(gif.lossy / 10) < 6,
    step: (gif) => ({ ...gif, lossy: 60 }),
    describe: (before, after) => `inter-frame merging raised from ${before.lossy} to ${after.lossy}`,
  },
  {
    applies: (gif) => round(gif.lossy / 10) < 12,
    step: (gif) => ({ ...gif, lossy: 120 }),
    describe: (before, after) => `inter-frame merging raised from ${before.lossy} to ${after.lossy}`,
  },
  {
    applies: (gif) => gif.colours > MIN_COLOURS,
    step: (gif) => ({ ...gif, colours: max(MIN_COLOURS, round(gif.colours * 0.75)) }),
    describe: (before, after) => `palette cut from ${before.colours} to ${after.colours} colours`,
  },
  {
    applies: (gif) => round(gif.lossy / 10) < MAX_INTER_FRAME_ERROR,
    step: (gif) => ({ ...gif, lossy: MAX_INTER_FRAME_ERROR * 10 }),
    describe: (before, after) => `inter-frame merging raised from ${before.lossy} to ${after.lossy}`,
  },
  {
    applies: (gif) => gif.fps / 2 >= MIN_FPS,
    step: (gif) => ({ ...gif, fps: gif.fps / 2 }),
    describe: (before, after) => `frame rate halved from ${before.fps} to ${after.fps}`,
  },
]

/**
 * Turn a sequence of captured frames into a finished GIF, inside a budget.
 *
 * This is the half of the sharp backend that never touches a video: given
 * frames and how long each is held, it quantises and writes the animation.
 * Both lanes reach it, from opposite directions. A browser scene demuxes a
 * recording into frames and arrives with a rate it has to make the best of; a
 * scripted scene draws each frame deliberately and arrives with exactly the
 * ones it meant, which is why it needs no video, no demuxer and no system
 * binary at all.
 *
 * Runs of identical frames are always folded into one, because that changes
 * nothing about what plays back. Everything else the optimiser does is a
 * compromise, taken only when the first encode is over budget and only in the
 * order the ladder states, and every one taken is reported so the audit record
 * says what the asset gave up.
 *
 * @param frames - The frames in order, each an encoded image or a path to one.
 * @param delaysMs - Display time of each frame, index for index.
 * @param gif - Encoding parameters for this scene.
 * @param outputPath - Absolute path the finished GIF is written to.
 * @param options - Transparency and whether the optimiser may run.
 * @returns What the finished file contains, and what it cost.
 * @throws {Error} When there are no frames, or the budget cannot be met without going past every floor.
 */
export async function encodeFrames(
  frames: readonly (Buffer | string)[],
  delaysMs: readonly number[],
  gif: GifOptions,
  outputPath: string,
  options: EncodeFramesOptions = {}
): Promise<FramesOutcome> {
  if (frames.length === 0) {
    throw mediaError(ExitCode.SceneFailed, 'No frames were captured, so there is nothing to encode.')
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  const transparent = options.transparent ?? false
  const compromises: string[] = []

  let applied = gif
  let source = await decodeFrames(frames, gif.width, transparent)
  let fpsDivisor = 1
  // why: decimation runs on the frames as captured and folding after it, so a pause the scene asked for is one held frame whatever the rate ends up being
  const prepare = (): FrameRun => {
    const thinned = decimate(source, delaysMs, fpsDivisor)
    return foldDuplicates(thinned.frames, thinned.delaysMs)
  }
  let current = prepare()
  let bytes = await writeGif(current.frames, current.delaysMs, applied, transparent, outputPath)

  if (options.optimise === true && gif.maxBytes > 0) {
    let rung = 0
    while (bytes > gif.maxBytes) {
      const next = LADDER[rung]
      if (next === undefined) {
        // why: the frame is the last thing to give, and it gives in small steps so the file that lands is the largest one under budget rather than the first one that fits
        const narrower = round(applied.width * WIDTH_STEP)
        if (narrower < gif.width * MIN_WIDTH_FRACTION) {
          throw mediaError(
            ExitCode.BudgetExceeded,
            `${formatBytes(bytes)} is still over the ${formatBytes(gif.maxBytes)} budget after ${compromises.join(', ')}. ` +
              'The scene has to show less: shorten it, hold fewer frames, or narrow what each frame carries.'
          )
        }
        compromises.push(`frame narrowed from ${applied.width} to ${narrower}px`)
        applied = { ...applied, width: narrower }
        source = await decodeFrames(frames, narrower, transparent)
      } else if (!next.applies(applied)) {
        rung += 1
        continue
      } else {
        const stepped = next.step(applied)
        compromises.push(next.describe(applied, stepped))
        if (stepped.fps !== applied.fps) {
          fpsDivisor *= 2
        }
        applied = stepped
        rung += 1
      }
      current = prepare()
      bytes = await writeGif(current.frames, current.delaysMs, applied, transparent, outputPath)
    }
  }

  return { bytes, frames: await countGifFrames(outputPath), applied, compromises }
}
