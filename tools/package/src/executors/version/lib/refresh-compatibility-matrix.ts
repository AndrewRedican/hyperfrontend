import type { FollowUp } from '@hyperfrontend/workspace/executors/version'
import { logger } from '@hyperfrontend/logging'
import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME, refreshCompatibilityDocument } from '@hyperfrontend/pipeline'

/**
 * Brings the root compatibility document in line with the manifests a version
 * run just changed, so it travels in the version commit instead of drifting
 * one bump behind until someone runs lint by hand.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param dryRun - If true, report what would change without writing.
 * @returns The workspace-relative files to commit: the document when it changed, nothing otherwise.
 *
 * @example Folding the document into a version run's modified files
 * ```typescript
 * modifiedFiles.push(...refreshCompatibilityMatrix(workspaceRoot, dryRun))
 * ```
 */
export function refreshCompatibilityMatrix(workspaceRoot: string, dryRun: boolean): string[] {
  if (dryRun) {
    // why: A dry run must leave the tree untouched, so the document is derived and compared without ever being written.
    const current = buildCompatibilityDocument(workspaceRoot)
    logger.debug(`would refresh ${COMPATIBILITY_DOCUMENT_NAME} (${current.length} characters)`)
    return []
  }
  const refreshed = refreshCompatibilityDocument(workspaceRoot)
  if (refreshed === null) {
    logger.debug(`${COMPATIBILITY_DOCUMENT_NAME} already matches the manifests`)
    return []
  }
  logger.debug(`refreshed ${COMPATIBILITY_DOCUMENT_NAME}`)
  return [refreshed]
}

/**
 * The compatibility document as a follow-up of a version run: refreshed after each bump, and
 * committed with it when it changed.
 *
 * @param _bump - The bump that was written; the document is derived from every manifest, so it is not read
 * @param run - The run the follow-up is called from
 * @returns The document, workspace-relative, when it changed
 *
 * @example Passing the follow-up to the published executor
 * ```typescript
 * versionExecutor({ ...options, followUps: [compatibilityFollowUp] }, context)
 * ```
 */
export const compatibilityFollowUp: FollowUp = (_bump, run) => refreshCompatibilityMatrix(run.workspaceRoot, run.dryRun)
