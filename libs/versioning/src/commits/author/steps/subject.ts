import type { CommitDraft } from '../../format/models/draft'
import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { text, PromptResult } from '@hyperfrontend/questions'
import { countHeaderLength } from '../../format/count-header'
import { cancelled, done } from '../models/step'

/**
 * Step that prompts for the commit subject. Strips the trailing period, trims
 * edges, and enforces a non-empty subject. Header-length warnings are surfaced
 * by the preview step's validation pass (the text prompt lacks per-keystroke
 * display hooks).
 */
export const subjectStep: Step = {
  id: 'subject',
  async run(ctx: SessionContext): Promise<StepResult> {
    const outcome = await text({
      message: renderSubjectMessage(ctx),
      ...(ctx.draft.subject && { initial: ctx.draft.subject }),
      validate: (value: string) => {
        const normalized = normalizeSubject(value)
        if (normalized === '') return 'Subject must not be empty'
        return undefined
      },
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (outcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    ctx.draft = { ...ctx.draft, subject: normalizeSubject(outcome.value) }
    return done()
  },
}

/**
 * Applies subject normalisation rules (decision D10): trim edges and strip a
 * single trailing period.
 *
 * @param raw - Subject string as entered by the user
 * @returns Normalized subject
 *
 * @example Stripping whitespace and a trailing period
 * ```typescript
 * normalizeSubject('  add login flow.  ') // => 'add login flow'
 * ```
 */
export function normalizeSubject(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.endsWith('.')) return trimmed.slice(0, -1).trimEnd()
  return trimmed
}

/**
 * Builds the prompt label, including a header countdown when the config
 * defines a `headerMaxLength` budget. The countdown reflects the characters
 * already consumed by `type(scope)!: `, so the user can see how much budget
 * remains before typing.
 *
 * @param ctx - Session context (used to inspect the draft so far)
 * @returns Prompt label
 */
function renderSubjectMessage(ctx: SessionContext): string {
  const budget = ctx.config.headerMaxLength
  if (budget === null) return 'Subject:'
  const used = countHeaderLength(<CommitDraft>{ type: ctx.draft.type, scope: ctx.draft.scope }, '')
  const remaining = budget - used
  return `Subject (${remaining} chars left in ${budget}-char header):`
}
