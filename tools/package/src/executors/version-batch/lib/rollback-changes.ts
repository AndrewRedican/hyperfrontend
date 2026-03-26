import { deleteTag, discardAllChanges } from '@hyperfrontend/versioning/git/operations'
import { getLogger } from '../../version/lib/logger'

const logger = getLogger()

/**
 * Rolls back all uncommitted changes in the working directory.
 *
 * Uses discardAllChanges() to discard all modifications to tracked files
 * and unstage any staged changes.
 *
 * @param workspaceRoot - Absolute path to workspace root
 */
export async function rollbackChanges(workspaceRoot: string): Promise<void> {
  const success = discardAllChanges({ cwd: workspaceRoot })
  if (!success) {
    logger.warn('Failed to rollback changes')
  }
}

/**
 * Cleans up any git tags created during a failed batch operation.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param tags - List of tag names to delete
 */
export async function cleanupTags(workspaceRoot: string, tags: string[]): Promise<void> {
  for (const tag of tags) {
    // deleteTag returns false if tag doesn't exist, which is fine
    deleteTag(tag, { cwd: workspaceRoot })
  }
}
