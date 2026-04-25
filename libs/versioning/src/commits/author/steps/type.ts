import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { select, PromptResult } from '@hyperfrontend/questions'
import { typeToChoice } from '../models/session-config'
import { cancelled, done } from '../models/step'

/**
 * Step that prompts the user for the commit type. Uses the searchable select
 * prompt and seeds the cursor from any existing `ctx.draft.type` (so a preview
 * → cancel restart re-opens on the previous choice).
 */
export const typeStep: Step = {
  id: 'type',
  async run(ctx: SessionContext): Promise<StepResult> {
    const choices = ctx.config.types.map(typeToChoice)
    const initialIndex = ctx.draft.type ? choices.findIndex((choice) => choice.value === ctx.draft.type) : -1

    const outcome = await select({
      message: 'Select the type of change:',
      choices,
      searchable: true,
      ...(initialIndex >= 0 && { initial: initialIndex }),
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (outcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    ctx.draft = { ...ctx.draft, type: outcome.value }
    return done()
  },
}
