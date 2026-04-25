import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { text, PromptResult } from '@hyperfrontend/questions'
import { cancelled, done } from '../models/step'
import { omitKeys } from './utils/omit'

/**
 * Step that prompts for an optional commit body. Empty input leaves
 * `draft.body` unset (the formatter then omits the body section).
 */
export const bodyStep: Step = {
  id: 'body',
  async run(ctx: SessionContext): Promise<StepResult> {
    const outcome = await text({
      message: 'Body (optional, press Enter to skip):',
      ...(ctx.draft.body && { initial: ctx.draft.body }),
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (outcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    const trimmed = outcome.value.trim()
    ctx.draft = trimmed === '' ? omitBody(ctx) : { ...ctx.draft, body: trimmed }
    return done()
  },
}

/**
 * Removes the `body` field from the draft (rather than setting it to empty),
 * so the formatter behaves as if the user skipped the step.
 *
 * @param ctx - Session context
 * @returns Updated draft with `body` dropped
 */
function omitBody(ctx: SessionContext): SessionContext['draft'] {
  return omitKeys(ctx.draft, ['body'])
}
