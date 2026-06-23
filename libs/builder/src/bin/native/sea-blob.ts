import { spawnSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Inputs to {@link generateSeaBlob}.
 */
export interface GenerateSeaBlobInputs {
  /** Absolute path to a SEA configuration JSON written to disk. */
  seaConfigPath: string
  /** Absolute path the SEA configuration's `output` field points at; returned for caller convenience. */
  outputBlobPath: string
  /** Override for the Node executable used to run the SEA-config command. Defaults to `process.execPath`. */
  nodeExecutable?: string
}

/**
 * Outcome of a SEA blob generation attempt.
 */
export interface GenerateSeaBlobResult {
  /** Absolute path of the emitted blob (echoes `inputs.outputBlobPath`). */
  blobPath: string
  /** Exit status returned by the `node --experimental-sea-config` invocation. */
  status: number
}

/**
 * Spawns `node --experimental-sea-config <seaConfigPath>` to produce the SEA
 * preparation blob declared by the config's `output` field.
 *
 * Spawn errors and non-zero exit codes are surfaced as thrown `Error`s with the
 * captured stderr included; this function does not retry.
 *
 * @param inputs - Resolved SEA config path + the blob path declared in that config.
 * @returns The blob path (for chaining) and the spawn status.
 *
 * @example Generating the SEA prep blob
 * ```typescript
 * const result = generateSeaBlob({
 *   seaConfigPath: '/abs/dist/libs/builder/bin/hf-build.sea-config.json',
 *   outputBlobPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
 * })
 * ```
 */
export const generateSeaBlob = (inputs: GenerateSeaBlobInputs): GenerateSeaBlobResult => {
  const node = inputs.nodeExecutable ?? process.execPath
  const result = spawnSync(node, ['--experimental-sea-config', inputs.seaConfigPath], {
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (typeof result.status !== 'number' || result.status !== 0) {
    const stderr = (result.stderr ?? '').toString().trim()
    const detail = stderr.length > 0 ? `: ${stderr}` : ''
    throw createError(`node --experimental-sea-config failed with status ${String(result.status)}${detail}`)
  }
  return { blobPath: inputs.outputBlobPath, status: result.status }
}
