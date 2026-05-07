import type { BinConfig, BinOutput, BuildContext, SeaPlatform } from '../../models'
import { freemem } from 'node:os'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join, writeJsonFile } from '@hyperfrontend/project-scope/core'
import { removeCodesign } from './codesign'
import { dispatchInjectWorker, resolveDefaultInjectWorkerPath } from './dispatch'
import { resolveHostBinary } from './host-binary'
import { NODE_SEA_FUSE, NODE_SEA_MACHO_SEGMENT, NODE_SEA_RESOURCE_NAME } from './inject'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'
import { generateSeaBlob } from './sea-blob'
import { generateSeaConfig } from './sea-config'

const log = logger.channel('builder:bin:native')

const BYTES_PER_MB = 1024 * 1024
const formatMB = (bytes: number): string => (bytes / BYTES_PER_MB).toFixed(1)

const memorySnapshot = (label: string): void => {
  const usage = process.memoryUsage()
  log.info(`${label}: heap=${formatMB(usage.heapUsed)}MB rss=${formatMB(usage.rss)}MB free=${formatMB(freemem())}MB`)
}

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
 * Pipeline (current-platform-only — cross-platform matrices are orchestrated externally):
 * 1. Validate the bin declares CJS — SEA requires a CJS bundle as the embedded script.
 * 2. Skip silently with an info log if the current host doesn't match any declared platform.
 * 3. Generate the SEA config JSON and write it to disk.
 * 4. Spawn `node --experimental-sea-config <path>` to emit the SEA preparation blob.
 * 5. Resolve the Node host binary for the current platform (defaults to `process.execPath`).
 * 6. Dispatch a forked inject worker that clones the host, calls postject's `inject` to
 *    embed the blob, and writes the output binary. The ~138 MB Buffer postject allocates
 *    lives and dies in the child — the parent's RSS stays flat across this step.
 * 7. On macOS, strip the cloned signature so the injection doesn't invalidate it.
 *
 * Each step emits an info-level memory snapshot (parent heap, RSS, OS free) and a
 * duration log so the pipeline is observable end-to-end.
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
  memorySnapshot(`${bin.name}: pre-sea-config`)
  const seaConfig = generateSeaConfig({ mainPath: cjsOutputPath, outputPath: blobPath })
  writeJsonFile(seaConfigPath, seaConfig)

  memorySnapshot(`${bin.name}: pre-sea-blob`)
  const blobStart = dateNow()
  generateSeaBlob({ seaConfigPath, outputBlobPath: blobPath })
  log.info(`${bin.name}: sea blob generated in ${dateNow() - blobStart}ms`)

  const hostBinary = resolveHostBinary({ platform: <SeaPlatform>target })

  memorySnapshot(`${bin.name}: pre-inject (host=${hostBinary})`)
  const invocation = resolveDefaultInjectWorkerPath(ctx.workspaceRoot)
  if (!invocation) {
    throw createError(
      'inject worker could not be resolved for native bin build. Build @hyperfrontend/builder at least once before invoking the bin phase, or ensure @swc-node/register is installed for source-mode bootstrap.'
    )
  }
  try {
    const report = await dispatchInjectWorker(
      {
        hostBinary,
        outputBinary,
        blobPath,
        resourceName: NODE_SEA_RESOURCE_NAME,
        machoSegmentName: NODE_SEA_MACHO_SEGMENT,
        sentinelFuse: NODE_SEA_FUSE,
        reportPath: '',
      },
      { workerPath: invocation.path, execArgv: invocation.execArgv, label: bin.name }
    )
    log.info(
      `${bin.name}: inject completed in ${report.durationMs}ms (worker peak heap=${report.peakHeapMB.toFixed(1)}MB rss=${report.peakRssMB.toFixed(1)}MB)`
    )
  } catch (error) {
    log.error(`${bin.name}: postject inject failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
  memorySnapshot(`${bin.name}: post-inject`)

  removeCodesign({ binary: outputBinary })
  memorySnapshot(`${bin.name}: native build complete`)

  return [{ name: bin.name, kind: 'native', outputPath: outputBinary, platform: target }]
}
