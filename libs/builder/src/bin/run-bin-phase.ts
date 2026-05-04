import type { BinConfig, BinOutput, BuildContext } from '../models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { recover } from '../memory/recover'
import { buildNativeBin } from './native/build-native'
import { buildJsBin } from './script/build-bin'

const findCjsOutputPath = (jsOutputs: BinOutput[]): string | undefined => {
  for (const output of jsOutputs) if (output.kind === 'cjs') return output.outputPath
  return undefined
}

/**
 * Runs the bin phase: builds every declared JS bin, then emits a Node SEA native
 * binary for any bin that opts in via `bin.sea`. Returns the flattened list of
 * every output produced.
 *
 * For each bin, JS outputs are built first via {@link buildJsBin}. When the bin
 * also declares a `sea` block, the resulting CJS artifact (already on disk) is
 * passed to {@link buildNativeBin} as the SEA `main` script. Native emission is
 * skipped silently with an info log when the current host doesn't match any
 * declared platform — CI orchestrates the matrix so each declared platform is
 * built on the matching runner (see Phase 12).
 *
 * @param ctx - Resolved build context.
 * @param bins - Bin declarations to synthesize. Pass an empty array (or omit
 * `config.bin` from the facade) to skip the phase entirely.
 * @returns Flattened list of all bin outputs produced during the phase.
 *
 * @example Running the bin phase from a custom orchestrator
 * ```typescript
 * const binOutputs = await runBinPhase(context, config.bin ?? [])
 * ```
 */
export const runBinPhase = async (ctx: BuildContext, bins: BinConfig[]): Promise<BinOutput[]> => {
  const outputs: BinOutput[] = []
  for (const bin of bins) {
    const jsOutputs = await buildJsBin(bin, ctx)
    outputs.push(...jsOutputs)
    if (!bin.sea) continue
    const cjsOutputPath = findCjsOutputPath(jsOutputs)
    if (!cjsOutputPath) {
      throw createError(`SEA requires a CJS bin output; declare format: ['cjs'] or format: 'cjs' on bin ${bin.name}`)
    }
    await recover()
    const nativeOutputs = await buildNativeBin({ bin, ctx, cjsOutputPath })
    outputs.push(...nativeOutputs)
  }
  return outputs
}
