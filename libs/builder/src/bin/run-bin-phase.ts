import type { BinConfig, BinOutput, BuildContext } from '../models'
import { buildJsBin } from './script/build-bin'

/**
 * Runs the bin phase: builds every declared JS bin and aggregates their outputs.
 *
 * Native (Node SEA) binary emission is added in a later phase and is not orchestrated here.
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
    const built = await buildJsBin(bin, ctx)
    outputs.push(...built)
  }
  return outputs
}
