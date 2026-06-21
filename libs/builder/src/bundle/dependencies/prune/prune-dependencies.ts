import type { MemoryMonitor } from '../../../memory/monitor'
import type { BuildContext } from '../../../models'
import { logger } from '@hyperfrontend/logging'
import { depsRootOf } from '../../fs/deps-root'
import { stripDeadExportsPass } from './dead-export-pass'
import { destructureRequiresPass } from './destructure-requires-pass'
import { pruneOrphanChunks } from './orphan-chunks'
import { stripDeadPropertiesPass } from './property-strip-pass'
import { stripCommentsPass } from './strip-comments'

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
  /** Namespace slots spliced out of kept frozen-namespace literals by the Property Strip. */
  deadPropertiesRemoved: number
  /** Whole-module CJS require bindings collapsed to destructures by the Destructure pass. */
  requireBindingsDestructured: number
  /** Bytes reclaimed by the Comment Strip removing ordinary comments from surviving chunks. */
  commentBytesRemoved: number
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
 * exported declarations out of the surviving chunks. The Property Strip next
 * drops the unread slots of any kept, live frozen-namespace object and a second
 * Export Strip collapses the factories those slots held alive. A final sweep
 * reclaims chunks left with no importer, since narrowing a chunk's imports can
 * leave a sibling chunk unreferenced. The Destructure pass then collapses
 * whole-module CJS `const NS = require(...)` bindings to destructuring binds
 * wherever the binding is read only as static members and the edge is not in a
 * `require` cycle. A final Comment Strip removes ordinary
 * comments from the surviving chunks while preserving `@__PURE__` /
 * `@__NO_SIDE_EFFECTS__` annotations and legal comments. Removal is conservative:
 * anything whose removal cannot be proven safe — including the entire run when a
 * dynamic specifier is present — is left untouched.
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
  const depsRoot = depsRootOf(context)
  const orphans = pruneOrphanChunks(context, depsRoot)
  monitor?.check('bundle:dependencies:prune:orphans:end')
  const deadExports = stripDeadExportsPass(context, depsRoot)
  monitor?.check('bundle:dependencies:prune:dead-exports:end')
  const properties = stripDeadPropertiesPass(context, depsRoot)
  monitor?.check('bundle:dependencies:prune:property-strip:end')
  // why: dropping a namespace slot orphans the factory binding it held alive; a second export strip collapses those (and re-narrows the imports they pulled).
  const cascade =
    properties.deadPropertiesRemoved > 0 ? stripDeadExportsPass(context, depsRoot) : { deadExportsRemoved: 0, bytesRemoved: 0 }
  // why: a chunk whose last importing symbol was just stripped is now an orphan; reclaim it (and any d.ts left behind).
  const resweep = pruneOrphanChunks(context, depsRoot)
  // why: collapse whole-module CJS require bindings to destructures once the chunk surfaces are final; runs among the AST passes (before the comment strip) since it rewrites member-access spans.
  const destructured = destructureRequiresPass(depsRoot)
  monitor?.check('bundle:dependencies:prune:destructure-requires:end')
  // why: pure text and order-independent, but run last so it stays clear of the AST passes that read getFullStart()->getStart() trivia for @__PURE__ detection.
  const comments = stripCommentsPass(depsRoot)
  monitor?.check('bundle:dependencies:prune:comment-strip:end')
  const report: PruneReport = {
    orphanFilesRemoved: orphans.orphanFilesRemoved + resweep.orphanFilesRemoved,
    deadExportsRemoved: deadExports.deadExportsRemoved + cascade.deadExportsRemoved,
    deadPropertiesRemoved: properties.deadPropertiesRemoved,
    requireBindingsDestructured: destructured.requireBindingsDestructured,
    commentBytesRemoved: comments.commentBytesRemoved,
    bytesRemoved:
      orphans.bytesRemoved +
      deadExports.bytesRemoved +
      properties.bytesRemoved +
      cascade.bytesRemoved +
      resweep.bytesRemoved +
      comments.commentBytesRemoved,
  }
  if (
    report.orphanFilesRemoved > 0 ||
    report.deadExportsRemoved > 0 ||
    report.deadPropertiesRemoved > 0 ||
    report.requireBindingsDestructured > 0 ||
    report.commentBytesRemoved > 0
  ) {
    log.info(
      `pruned ${report.orphanFilesRemoved} orphan dependency file(s), ${report.deadExportsRemoved} dead export(s), and ${report.deadPropertiesRemoved} dead namespace slot(s), destructured ${report.requireBindingsDestructured} require binding(s), stripped ${report.commentBytesRemoved} comment byte(s), reclaimed ${report.bytesRemoved} byte(s)`
    )
  }
  return report
}
