import type { BinConfig, BinOutput, BuildContext, SeaPlatform } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join, writeJsonFile } from '@hyperfrontend/project-scope/core'
import { removeCodesign } from './codesign'
import { resolveHostBinary } from './host-binary'
import { injectBlob } from './inject'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'
import { generateSeaBlob } from './sea-blob'
import { generateSeaConfig } from './sea-config'

const log = logger.channel('builder:bin:native')

/**
 * Inputs to {@link buildNativeBin}.
 */
export interface BuildNativeBinInputs {
  /** Bin declaration. Must include a `sea` block; otherwise the function throws. */
  bin: BinConfig
  /** Resolved build context. */
  ctx: BuildContext
  /** Absolute path to the CJS bundle the SEA blob will execute. Must already be written to disk. */
  cjsOutputPath: string
}

const requireSeaConfig = (bin: BinConfig): readonly SeaPlatform[] => {
  if (!bin.sea) throw createError(`buildNativeBin called for bin '${bin.name}' without a sea config`)
  return bin.sea.platforms
}

const requireCjsFormat = (bin: BinConfig): void => {
  const formats = isArray(bin.format) ? bin.format : [bin.format]
  if (!formats.includes('cjs')) {
    throw createError(`SEA requires a CJS bin output; declare format: ['cjs'] or format: 'cjs' on bin ${bin.name}`)
  }
}

const resolveOutputBinaryPath = (binDir: string, name: string, target: string): string => {
  const isWindows = target.startsWith('win32-')
  return join(binDir, isWindows ? `${name}.${target}.exe` : `${name}.${target}`)
}

/**
 * Builds the Node SEA native binary for a single bin declaration.
 *
 * Pipeline (current-platform-only — see Phase 12 for the cross-platform CI matrix):
 * 1. Validate the bin declares CJS — SEA requires a CJS bundle as the embedded script.
 * 2. Skip silently with an info log if the current host doesn't match any declared platform.
 * 3. Generate the SEA config JSON and write it to disk.
 * 4. Spawn `node --experimental-sea-config <path>` to emit the SEA preparation blob.
 * 5. Resolve the Node host binary for the current platform (defaults to `process.execPath`).
 * 6. Clone the host to the output path and run postject's `inject` to embed the blob.
 * 7. On macOS, strip the cloned signature so the injection doesn't invalidate it.
 *
 * Native binaries are not auto-wired into `package.json#bin` — they are shipped
 * as separate release artifacts (see Q22 in the implementation plan).
 *
 * @param inputs - Bin declaration, resolved context, and the path to the already-built CJS bundle.
 * @returns A single {@link BinOutput} of kind `native` for the current platform, or `[]` if skipped.
 *
 * @example Producing the SEA binary for the current runner
 * ```typescript
 * const outputs = await buildNativeBin({
 *   bin: { name: 'hf-build', format: 'cjs', sea: { platforms: ['linux-x64'] } },
 *   ctx: context,
 *   cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js',
 * })
 * ```
 */
export const buildNativeBin = async (inputs: BuildNativeBinInputs): Promise<BinOutput[]> => {
  const { bin, ctx, cjsOutputPath } = inputs
  requireCjsFormat(bin)
  const platforms = requireSeaConfig(bin)

  const target = currentPlatformTarget()
  if (!currentPlatformMatches(platforms)) {
    log.info(`skipping native build for ${bin.name}: current platform ${target} not in declared targets [${platforms.join(', ')}]`)
    return []
  }

  const binDir = join(ctx.outputPath, 'bin')
  ensureDir(binDir)

  const seaConfigPath = join(binDir, `${bin.name}.sea-config.json`)
  const blobPath = join(binDir, `${bin.name}.sea-prep.blob`)
  const outputBinary = resolveOutputBinaryPath(binDir, bin.name, target)

  log.info(`building native bin: ${bin.name} (${target})`)
  const seaConfig = generateSeaConfig({ mainPath: cjsOutputPath, outputPath: blobPath })
  writeJsonFile(seaConfigPath, seaConfig)
  generateSeaBlob({ seaConfigPath, outputBlobPath: blobPath })

  const hostBinary = resolveHostBinary({ platform: <SeaPlatform>target })
  await injectBlob({ hostBinary, outputBinary, blobPath })
  removeCodesign({ binary: outputBinary })

  return [{ name: bin.name, kind: 'native', outputPath: outputBinary, platform: target }]
}
