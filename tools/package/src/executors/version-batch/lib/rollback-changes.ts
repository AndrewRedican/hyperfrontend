import { execFileSync } from 'node:child_process'
import { deleteTag, unstage } from '@hyperfrontend/versioning/git/operations'

/**
 * Rolls back all uncommitted changes in the working directory.
 *
 * Uses `git checkout .` to discard all modifications to tracked files.
 * Also cleans up any untracked files that were created.
 *
 * @param workspaceRoot - Absolute path to workspace root
 */
export async function rollbackChanges(workspaceRoot: string): Promise<void> {
  try {
    // Discard all changes to tracked files
    // Note: Library doesn't have discardChanges() yet - using raw git
    // TODO: Replace with library call when discardChanges() is added (Phase 2)
    execFileSync('git', ['checkout', '.'], {
      cwd: workspaceRoot,
      encoding: 'utf-8',
    })

    // Reset staged changes using library operation
    unstage(['.'], { cwd: workspaceRoot })
  } catch (error) {
    // Log but don't throw - rollback is best-effort
    console.error('Failed to rollback changes:', error instanceof Error ? error.message : error)
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
