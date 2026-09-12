import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { globalIsNaN, parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

/** The prefix that asks for moments spread evenly rather than listed. */
const EVERY = 'every:'

/**
 * Read the moments to draw off the command line.
 *
 * `--at` is either a comma-separated list of offsets, or `every:N`, which
 * spreads N moments evenly over the timeline and ends on its last frame: the
 * question a sheet usually answers is whether the whole scene fits, and the
 * end of the timeline is where the most has arrived.
 *
 * @param spec - The `--at` value as written.
 * @param durationMs - Length of the scene's timeline.
 * @returns The moments, in the order they are drawn.
 * @throws {Error} When the value parses to nothing.
 * @example Four moments across a ten second scene
 * ```ts
 * readMoments('every:4', 10_000) // [2500, 5000, 7500, 10000]
 * ```
 */
export function readMoments(spec: string, durationMs: number): readonly number[] {
  if (spec.startsWith(EVERY)) {
    const count = parseInteger(spec.slice(EVERY.length), 10)
    if (globalIsNaN(count) || count < 1) {
      throw mediaError(ExitCode.Usage, '--at every:N needs a count of one or more')
    }
    const moments: number[] = []
    for (let index = 1; index <= count; index += 1) {
      moments.push(round((durationMs * index) / count))
    }
    return moments
  }
  const moments = spec
    .split(',')
    .map((token) => parseInteger(token.trim(), 10))
    .filter((value) => !globalIsNaN(value))
  if (moments.length === 0) {
    throw mediaError(ExitCode.Usage, '--at needs one or more millisecond offsets, comma separated, or every:N')
  }
  return moments
}
