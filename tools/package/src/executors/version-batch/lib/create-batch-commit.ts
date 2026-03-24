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
    throw new Error('No files to commit')
  }

  if (libraries.length === 0) {
    throw new Error('No libraries to include in commit message')
  }

  // Stage all modified files
  const staged = stage(files, { cwd: workspaceRoot })
  if (!staged) {
    throw new Error('Failed to stage files for commit')
  }

  // Create commit message
  const commitMessage = formatBatchCommitMessage(libraries)

  // Create commit with --no-verify to skip hooks (we're creating the version commit)
  const gitCommit = commit(commitMessage, { cwd: workspaceRoot, noVerify: true })

  return gitCommit.hash
}

/**
 * Formats the commit message for a batch version update.
 *
 * Format: `chore: update versions for lib-a, lib-b, lib-c`
 *
 * For many libraries, truncates the list to keep message readable.
 *
 * @param libraries - List of library names that were bumped
 * @returns Formatted commit message
 */
function formatBatchCommitMessage(libraries: string[]): string {
  const MAX_LIBS_IN_MESSAGE = 10

  if (libraries.length <= MAX_LIBS_IN_MESSAGE) {
    return `chore: update versions for ${libraries.join(', ')}`
  }

  const shown = libraries.slice(0, MAX_LIBS_IN_MESSAGE)
  const remaining = libraries.length - MAX_LIBS_IN_MESSAGE

  return `chore: update versions for ${shown.join(', ')} and ${remaining} more`
}
