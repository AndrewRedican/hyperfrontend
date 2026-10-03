import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME, refreshCompatibilityDocument } from '@hyperfrontend/workspace'
import { getLogger } from './logger'

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
  const logger = getLogger().channel('refreshCompatibilityMatrix')
  if (dryRun) {
    // why: A dry run must leave the tree untouched, so the document is derived and compared without ever being written.
    const current = buildCompatibilityDocument(workspaceRoot)
    logger.step(`would refresh ${COMPATIBILITY_DOCUMENT_NAME} (${current.length} characters)`)
    return []
  }
  const refreshed = refreshCompatibilityDocument(workspaceRoot)
  if (refreshed === null) {
    logger.step(`${COMPATIBILITY_DOCUMENT_NAME} already matches the manifests`)
    return []
  }
  logger.step(`refreshed ${COMPATIBILITY_DOCUMENT_NAME}`)
  return [refreshed]
}
