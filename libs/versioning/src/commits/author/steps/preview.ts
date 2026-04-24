import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { logger } from '@hyperfrontend/logging'
import { confirm, PromptResult } from '@hyperfrontend/questions'
import { formatCommitMessage } from '../../format/format-message'
import { parseConventionalCommit } from '../../parse/message'
import { validateCommit } from '../../validate/engine'
import { cancelled, done, goto } from '../models/step'

/** Step id the preview jumps back to when the user rejects the draft. */
export const PREVIEW_RESTART_STEP_ID = 'type'

/**
 * Step that renders the accumulated draft as the final commit message and
 * asks the user to confirm. A negative answer jumps back to the `type` step
 * while keeping the draft intact for round-trip editing. Validation warnings
 * are printed before the prompt.
 */
export const previewStep: Step = {
  id: 'preview',
  async run(ctx: SessionContext): Promise<StepResult> {
    const message = formatCommitMessage(ctx.draft)
    writePreview(ctx, message)

    const outcome = await confirm({
      message: 'Commit this message?',
      initial: true,
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (outcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    if (!outcome.value) {
      return goto(PREVIEW_RESTART_STEP_ID)
    }

    return done()
  },
}

/**
 * Prints the preview block (message + any validation warnings) to the session
 * output so the user can review before confirming.
 *
 * @param ctx - Session context holding the resolved config and draft
 * @param message - Fully formatted commit message to display
 */
function writePreview(ctx: SessionContext, message: string): void {
  logger.log('')
  logger.log(message)
  const validation = validateCommit(parseConventionalCommit(message), ctx.config.validateRuleset)
  for (const warning of validation.warnings) {
    logger.log(`warn(${warning.ruleName}): ${warning.message}`)
  }
  for (const error of validation.errors) {
    logger.log(`error(${error.ruleName}): ${error.message}`)
  }
  logger.log('')
}
