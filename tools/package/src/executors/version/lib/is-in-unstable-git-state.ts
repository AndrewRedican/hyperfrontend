import { getOperationState } from '@hyperfrontend/versioning'
import { getLogger } from './logger'

/**
 * Checks if git is in a rebase or merge state.
 *
 * Thin wrapper around `getOperationState()` from lib-versioning that adds
 * executor-specific logging.
 *
 * @param cwd - Working directory
 * @returns True if in unstable state
 */
export function isInUnstableGitState(cwd: string): boolean {
  const logger = getLogger().channel('isInUnstableGitState')
  logger.debug(`checking git state in "${cwd}"`)

  const state = getOperationState({ cwd })

  if (state.inProgress) {
    const { rebaseMerge, rebaseApply, mergeHead } = state.details
    logger.info(`detected unstable git state (rebase-merge: ${rebaseMerge}, rebase-apply: ${rebaseApply}, MERGE_HEAD: ${mergeHead})`)
  } else {
    logger.debug(`git state is stable`)
  }

  return state.inProgress
}
