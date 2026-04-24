import type { CommitFooter } from '../../models/conventional'
import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { confirm, text, PromptResult } from '@hyperfrontend/questions'
import { isBreakingFooterKey } from '../../models/breaking'
import { cancelled, done } from '../models/step'
import { omitKeys } from './utils/omit'

/**
 * Step that asks whether the commit introduces a breaking change. A positive
 * answer follows up with a description prompt; the description is written to
 * `draft.breakingDescription` and is eventually synthesized into a
 * `BREAKING CHANGE:` footer by `formatCommitMessage`.
 */
export const breakingStep: Step = {
  id: 'breaking',
  async run(ctx: SessionContext): Promise<StepResult> {
    const confirmOutcome = await confirm({
      message: 'Is this a breaking change?',
      initial: ctx.draft.breaking ?? false,
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (confirmOutcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    if (!confirmOutcome.value) {
      ctx.draft = clearBreaking(ctx.draft)
      return done()
    }

    const descriptionOutcome = await text({
      message: 'Describe the breaking change:',
      ...(ctx.draft.breakingDescription && { initial: ctx.draft.breakingDescription }),
      validate: (value: string) => (value.trim() === '' ? 'Description must not be empty' : undefined),
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (descriptionOutcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    ctx.draft = {
      ...ctx.draft,
      breaking: true,
      breakingDescription: descriptionOutcome.value.trim(),
    }
    return done()
  },
}

/**
 * Clears any breaking-change state left on the draft by a previous session
 * iteration (preview → cancel → restart). Also removes an existing
 * `BREAKING CHANGE:`-family footer so the preview does not double-print.
 *
 * @param draft - Draft to clean
 * @returns Draft without the breaking-change markers
 */
function clearBreaking(draft: SessionContext['draft']): SessionContext['draft'] {
  const rest = omitKeys(draft, ['breaking', 'breakingDescription', 'footers'])
  if (!draft.footers) return { ...rest, breaking: false }
  const filtered: readonly CommitFooter[] = draft.footers.filter((footer) => !isBreakingFooterKey(footer.key))
  return {
    ...rest,
    breaking: false,
    ...(filtered.length > 0 && { footers: filtered }),
  }
}
