import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getLogger } from './logger'

/**
 * Checks if git is in a rebase or merge state.
 *
 * @param cwd - Working directory
 * @returns True if in unstable state
 */
export function isInUnstableGitState(cwd: string): boolean {
  const logger = getLogger().channel('isInUnstableGitState')
  try {
    logger.debug(`checking git state in "${cwd}"`)
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const rebaseMerge = existsSync(join(cwd, gitDir, 'rebase-merge'))
    const rebaseApply = existsSync(join(cwd, gitDir, 'rebase-apply'))
    const mergeHead = existsSync(join(cwd, gitDir, 'MERGE_HEAD'))

    const isUnstable = rebaseMerge || rebaseApply || mergeHead
    if (isUnstable) {
      logger.info(`detected unstable git state (rebase-merge: ${rebaseMerge}, rebase-apply: ${rebaseApply}, MERGE_HEAD: ${mergeHead})`)
    } else {
      logger.debug(`git state is stable`)
    }
    return isUnstable
  } catch (error) {
    logger.debug(`error checking git state - ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}
