import { copyFileSync, readFileSync } from 'node:fs'
import { inject } from 'postject'

/**
 * Inputs to {@link injectBlob}.
 */
export interface InjectBlobInputs {
  /** Absolute path to the Node host binary to clone as the injection target. */
  hostBinary: string
  /** Absolute path where the cloned + injected binary should land. */
  outputBinary: string
  /** Absolute path to the SEA preparation blob produced by `node --experimental-sea-config`. */
  blobPath: string
  /** Resource name for the injected SEA section. Defaults to Node's expected `NODE_SEA_BLOB`. */
  resourceName?: string
  /** Mach-O segment name for macOS injection. Defaults to Node's expected `NODE_SEA`. */
  machoSegmentName?: string
  /** SEA fuse string searched for in the binary. Defaults to Node's standard SEA fuse. */
  sentinelFuse?: string
}

/**
 * Node's expected SEA resource name. Hardcoded by the runtime when looking up
 * the embedded blob, so this value is required for the resulting binary to
 * function as a single-executable application.
 */
export const NODE_SEA_RESOURCE_NAME = 'NODE_SEA_BLOB'

/**
 * Node's expected Mach-O segment name for SEA blobs on macOS.
 */
export const NODE_SEA_MACHO_SEGMENT = 'NODE_SEA'

/**
 * Sentinel fuse string Node's runtime flips from `0` → `1` to mark a SEA-injected binary.
 */
export const NODE_SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

/**
 * Clones the Node host binary to `outputBinary` and injects the SEA preparation
 * blob via [postject](https://www.npmjs.com/package/postject)'s programmatic API.
 *
 * The host binary itself is never modified — postject mutates the cloned copy
 * at `outputBinary`. The injection uses Node's expected SEA resource name and
 * fuse so the produced executable is recognized by Node's SEA runtime.
 *
 * Callers are responsible for adjusting code-signing afterwards (see
 * {@link removeCodesign} for macOS).
 *
 * @param inputs - Host binary, target output path, and blob path.
 *
 * @example Producing a SEA binary on a Linux runner
 * ```typescript
 * await injectBlob({
 *   hostBinary: process.execPath,
 *   outputBinary: '/abs/dist/libs/builder/bin/hf-build.linux-x64',
 *   blobPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
 * })
 * ```
 */
export const injectBlob = async (inputs: InjectBlobInputs): Promise<void> => {
  copyFileSync(inputs.hostBinary, inputs.outputBinary)
  const blob = readFileSync(inputs.blobPath)
  await inject(inputs.outputBinary, inputs.resourceName ?? NODE_SEA_RESOURCE_NAME, blob, {
    machoSegmentName: inputs.machoSegmentName ?? NODE_SEA_MACHO_SEGMENT,
    sentinelFuse: inputs.sentinelFuse ?? NODE_SEA_FUSE,
  })
}
