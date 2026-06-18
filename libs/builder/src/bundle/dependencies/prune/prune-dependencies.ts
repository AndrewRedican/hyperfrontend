import type { MemoryMonitor } from '../../../memory/monitor'
import type { BuildContext } from '../../../models'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { stripDeadExportsPass } from './dead-export-pass'
import { pruneOrphanChunks } from './orphan-chunks'

const log = logger.channel('builder:bundle:dependencies:prune')

/**
 * Aggregate result of pruning dead dependency code from `_dependencies/`.
 *
 * `deadExportsRemoved` is always `0` in the Orphan Sweep; the Export Strip
 * populates it.
 */
export interface PruneReport {
  /** Whole chunk files (and `.map`/`.d.ts.map` siblings) unlinked as orphans. */
  orphanFilesRemoved: number
  /** Exported declarations spliced out of surviving chunks by the Export Strip. */
  deadExportsRemoved: number
  /** Total bytes reclaimed across all removals. */
  bytesRemoved: number
}

/**
 * Final, always-on bundle step that removes guaranteed-unused dependency code
 * from `dist/libs/<pkg>/_dependencies/`.
 *
 * The pre-pass emits every hoisted dep at its full public-API surface; this
 * step trims what the consuming package provably never reaches. The Orphan
 * Sweep deletes whole orphan chunk files (JS + co-located d.ts) whose runtime is
 * unreachable from the package's entry chunks. The Export Strip then strips dead
 * exported declarations out of the surviving chunks and re-runs the sweep, since narrowing a
 * chunk's imports can leave a sibling chunk with no importer at all. Removal is
 * conservative: anything whose removal cannot be proven safe — including the
 * entire run when a dynamic specifier is present — is left untouched.
 *
 * @param context - Resolved build context. `outputPath` locates `_dependencies/`.
 * @param monitor - Optional memory monitor; checkpoints are captured after the
 * orphan sweep and after the dead-export pass so the step is observable.
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
  const deadExports = stripDeadExportsPass(context, depsRoot)
  monitor?.check('bundle:dependencies:prune:dead-exports:end')
  // why: a chunk whose last importing symbol was just stripped is now an orphan; reclaim it (and any d.ts left behind).
  const resweep = pruneOrphanChunks(context, depsRoot)
  const report: PruneReport = {
    orphanFilesRemoved: orphans.orphanFilesRemoved + resweep.orphanFilesRemoved,
    deadExportsRemoved: deadExports.deadExportsRemoved,
    bytesRemoved: orphans.bytesRemoved + deadExports.bytesRemoved + resweep.bytesRemoved,
  }
  if (report.orphanFilesRemoved > 0 || report.deadExportsRemoved > 0) {
    log.info(
      `pruned ${report.orphanFilesRemoved} orphan dependency file(s) and ${report.deadExportsRemoved} dead export(s), reclaimed ${report.bytesRemoved} byte(s)`
    )
  }
  return report
}
