import type { CommitExecutor } from '../models/session-config'
import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { commit as gitCommit } from '../../../git/operations/commit'
import { formatCommitMessage } from '../../format/format-message'
import { cancelled, done } from '../models/step'

/**
 * Step that renders the draft one last time and hands the message to the
 * configured commit executor. When `config.skipCommit` is true the step
 * short-circuits so the caller receives the formatted message without
 * touching the working tree.
 */
export const commitStep: Step = {
  id: 'commit',
  async run(ctx: SessionContext): Promise<StepResult> {
    if (ctx.config.skipCommit) return done()

    const message = formatCommitMessage(ctx.draft)
    const executor: CommitExecutor = ctx.config.commitExecutor ?? defaultCommitExecutor(ctx.config.cwd)
    try {
      await executor(message)
    } catch (unknown) {
      const error = unknown instanceof Error ? unknown : createError(String(unknown))
      return cancelled(error)
    }
    return done()
  },
}

/**
 * Builds the default `CommitExecutor` that shells out to
 * `libs/versioning/src/git/operations/commit.ts` (D15c).
 *
 * @param cwd - Working directory the commit should run in
 * @returns Commit executor bound to the supplied cwd
 */
function defaultCommitExecutor(cwd: string): CommitExecutor {
  return (message: string) => {
    gitCommit(message, { cwd })
  }
}
