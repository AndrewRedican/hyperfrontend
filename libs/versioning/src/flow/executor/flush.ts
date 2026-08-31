/* eslint-disable @nx/enforce-module-boundaries */
import type { FileChange, FileDiff, Tree } from '@hyperfrontend/project-scope/vfs'
import type { Logger } from '../models/types'
import { commitChanges, formatUnifiedDiff, generateAllDiffs } from '@hyperfrontend/project-scope/vfs'

/** Writes a run's pending file changes to disk, once. */
export interface DiskFlusher {
  /** Writes pending changes to disk. Does nothing after the first call, or in a dry run. */
  flush(): void

  /** The changes captured at flush time, or undefined while nothing has been flushed. */
  readonly changes: readonly FileChange[] | undefined

  /** The diffs captured at flush time, or undefined when none were requested. */
  readonly diffs: readonly FileDiff[] | undefined
}

/** What to say about a run's pending file changes. */
export interface ReportChangesOptions {
  /** The changes the run produced. */
  changes: readonly FileChange[]
  /** Diffs for those changes, when they were requested. */
  diffs: readonly FileDiff[] | undefined
  /** Whether the caller asked to see diffs. */
  showDiff: boolean
  /** Whether to print whole patches or only per-file counts. */
  diffFormat: 'unified' | 'summary' | undefined
  /** Whether to list each changed file when diffs were not requested. */
  verbose: boolean
  /** Whether the run only previewed the changes. */
  dryRun: boolean
  /** Receives the report. */
  logger: Logger
}

/**
 * Describes a run's pending file changes.
 *
 * Reports the changes themselves rather than the tree, so the account is the
 * same whether they have already been written or are only being previewed.
 *
 * @param options - The changes to describe and how much detail to give
 *
 * @example Listing what a dry run would write
 * ```typescript
 * reportChanges({
 *   changes: tree.listChanges(),
 *   diffs: undefined,
 *   showDiff: false,
 *   diffFormat: undefined,
 *   verbose: false,
 *   dryRun: true,
 *   logger,
 * })
 * ```
 */
export function reportChanges(options: ReportChangesOptions): void {
  const { changes, diffs, showDiff, diffFormat, verbose, dryRun, logger } = options

  if (showDiff && changes.length === 0) {
    logger.info('No file changes to commit')
  } else if (showDiff && diffs) {
    logger.info(`\n${'='.repeat(60)}\nPending changes:\n${'='.repeat(60)}`)
    for (const diff of diffs) {
      logger.info(diffFormat === 'summary' ? `${diff.path}: +${diff.additions} -${diff.deletions}` : formatUnifiedDiff(diff))
    }
  } else if (verbose && changes.length > 0) {
    logger.info(`Pending changes: ${changes.length} file(s)`)
    for (const change of changes) {
      logger.info(`  [${change.type}] ${change.path}`)
    }
  }

  if (!dryRun) return

  if (changes.length === 0) {
    logger.info('Dry run mode - no changes to write')
    return
  }

  logger.info(`Dry run - would modify ${changes.length} file(s):`)
  for (const change of changes) {
    logger.info(`  [${change.type}] ${change.path}`)
  }
}

/** What a flusher needs in order to write and report. */
export interface CreateDiskFlusherOptions {
  /** The tree holding pending writes. */
  tree: Tree
  /** Whether the run may write to disk at all. */
  dryRun: boolean
  /** Whether to capture diffs alongside the change list. */
  showDiff: boolean
  /** Whether the underlying write should log each file. */
  verbose?: boolean
  /** Receives progress and failure messages. */
  logger: Logger
}

/**
 * Creates a flusher that writes pending tree changes to disk at most once.
 *
 * The change list, and any requested diffs, are captured before the write,
 * because flushing clears the tree while the run still has to report what it
 * wrote. Steps that shell out to another tool, such as staging files for a
 * commit, need the flush to happen before they run rather than after the last
 * step.
 *
 * @param options - The tree to flush and how to report on it
 * @returns A flusher whose captured changes survive the write
 *
 * @example Flushing before a step that reads the real filesystem
 * ```typescript
 * const flusher = createDiskFlusher({ tree, dryRun: false, showDiff: false, logger })
 * if (step.requiresDiskFlush) flusher.flush()
 * const written = flusher.changes ?? tree.listChanges()
 * ```
 */
export function createDiskFlusher(options: CreateDiskFlusherOptions): DiskFlusher {
  const { tree, dryRun, showDiff, verbose, logger } = options

  let captured: readonly FileChange[] | undefined
  let capturedDiffs: readonly FileDiff[] | undefined

  return {
    get changes() {
      return captured
    },
    get diffs() {
      return capturedDiffs
    },
    flush() {
      if (captured !== undefined || dryRun) return

      captured = tree.listChanges()
      if (showDiff && captured.length > 0) {
        capturedDiffs = generateAllDiffs(tree)
      }

      try {
        commitChanges(tree, { verbose })
        logger.info('File changes committed to disk')
      } catch (error) {
        logger.error(`Failed to commit file changes: ${error}`)
      }
    },
  }
}
