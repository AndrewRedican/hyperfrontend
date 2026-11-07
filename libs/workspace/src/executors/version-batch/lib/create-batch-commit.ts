import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { commit, stage } from '@hyperfrontend/versioning/git/operations'

/**
 * Creates a batch commit containing all the version changes.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param files - List of files to stage
 * @param libraries - List of library names that were bumped
 * @returns The commit hash of the created commit
 */
export async function createBatchCommit(workspaceRoot: string, files: string[], libraries: string[]): Promise<string> {
  if (files.length === 0) {
    throw createError('No files to commit')
  }

  if (libraries.length === 0) {
    throw createError('No libraries to include in commit message')
  }

  const staged = stage(files, { cwd: workspaceRoot })
  if (!staged) {
    throw createError('Failed to stage files for commit')
  }

  const commitMessage = formatBatchCommitMessage(libraries)

  const gitCommit = commit(commitMessage, { cwd: workspaceRoot, noVerify: true })

  return gitCommit.hash
}

/**
 * Formats the commit message for a batch version update: `chore: update versions for lib-a, lib-b`,
 * naming every library bumped, because the version check recognises the commit by the names in
 * its subject and a truncated list would hide the ones past it.
 *
 * @param libraries - List of library names that were bumped
 * @returns Formatted commit message
 */
function formatBatchCommitMessage(libraries: string[]): string {
  return `chore: update versions for ${libraries.join(', ')}`
}
