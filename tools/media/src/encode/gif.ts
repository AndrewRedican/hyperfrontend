import type { EncoderConfig } from '../models/config'
import type { GifEncodeOutcome, GifEncodeRequest } from '../models/encode'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { assertWithinBudget } from './budget'
import { resolveBackend } from './resolve-backend'

/**
 * Encode a recorded video into a finished, budgeted GIF.
 *
 * The backend is resolved per run rather than per call so that every asset in
 * one run is produced the same way, which is what makes two assets in the same
 * commit comparable.
 *
 * @param request - Source, destination and encoding parameters.
 * @param encoder - The workspace's encoder configuration.
 * @param slug - Directory name of the scene, used in the budget message.
 * @returns What the finished file contains.
 * @throws {Error} When no backend can run, or the result is over budget.
 */
export async function encodeGif(request: GifEncodeRequest, encoder: EncoderConfig, slug: string): Promise<GifEncodeOutcome> {
  mkdirSync(dirname(request.outputPath), { recursive: true })
  const outcome = await resolveBackend(encoder).encode(request, encoder.binaries)
  assertWithinBudget(slug, outcome.bytes, request.gif.maxBytes)
  return outcome
}
