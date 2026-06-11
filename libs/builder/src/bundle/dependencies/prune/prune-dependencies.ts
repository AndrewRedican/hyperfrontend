import type { MemoryMonitor } from '../../../memory/monitor'
import type { BuildContext } from '../../../models'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { pruneOrphanChunks } from './orphan-chunks'

const log = logger.channel('builder:bundle:dependencies:prune')

/**
 * Aggregate result of pruning dead dependency code from `_dependencies/`.
 *
 * `deadExportsRemoved` is always `0` in the Tier-1 (orphan-file) pass; Phase 2
 * (dead-export stripping) populates it.
 */
export interface PruneReport {
  /** Whole chunk files (and `.map`/`.d.ts.map` siblings) unlinked as orphans. */
  orphanFilesRemoved: number
  /** Exported declarations spliced out of surviving chunks (Phase 2). */
  deadExportsRemoved: number
  /** Total bytes reclaimed across all removals. */
  bytesRemoved: number
}

/**
 * Final, always-on bundle step that removes guaranteed-unused dependency code
 * from `dist/libs/<pkg>/_dependencies/`.
 *
 * The pre-pass emits every hoisted dep at its full public-API surface; this
 * step trims what the consuming package provably never reaches. Tier 1 deletes
 * whole orphan chunk files (JS + co-located d.ts) whose runtime is unreachable
 * from the package's entry chunks. Removal is conservative: anything whose
 * removal cannot be proven safe — including the entire run when a dynamic
 * specifier is present — is left untouched.
 *
 * @param context - Resolved build context. `outputPath` locates `_dependencies/`.
 * @param monitor - Optional memory monitor; a checkpoint is captured after the
 * orphan sweep so the step is observable.
 * @returns Counts of files removed, dead exports removed, and bytes reclaimed.
 *
 * @example Pruning after the per-entry d.ts pass
 * ```typescript
 * const report = pruneDependencies(context, monitor)
 * ```
 */
export const pruneDependencies = (context: BuildContext, monitor?: MemoryMonitor): PruneReport => {
  const depsRoot = join(context.outputPath, '_dependencies')
  const orphans = pruneOrphanChunks(context, depsRoot)
  monitor?.check('bundle:dependencies:prune:orphans:end')
  const report: PruneReport = {
    orphanFilesRemoved: orphans.orphanFilesRemoved,
    deadExportsRemoved: 0,
    bytesRemoved: orphans.bytesRemoved,
  }
  if (report.orphanFilesRemoved > 0) {
    log.info(`pruned ${report.orphanFilesRemoved} orphan dependency file(s), reclaimed ${report.bytesRemoved} byte(s)`)
  }
  return report
}
