import type { CommitDraft } from '../../format/models/draft'
import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { style, text, PromptResult } from '@hyperfrontend/questions'
import { countHeaderLength } from '../../format/count-header'
import { cancelled, done } from '../models/step'

/**
 * Step that prompts for the commit subject. Strips the trailing period, trims
 * edges, and enforces a non-empty subject. When `headerMaxLength` is set, a
 * live countdown re-renders on every keystroke (green → yellow → red as the
 * remaining budget shrinks).
 */
export const subjectStep: Step = {
  id: 'subject',
  async run(ctx: SessionContext): Promise<StepResult> {
    const outcome = await text({
      message: renderSubjectMessage(ctx, ''),
      renderMessage: (value: string) => renderSubjectMessage(ctx, value),
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
 * Builds the prompt label, including a live header countdown when the config
 * defines a `headerMaxLength` budget. The countdown reflects the prefix
 * (`type(scope)!: `) plus the subject being typed, colored by remaining
 * budget (decision D11): green when comfortable, yellow within the last 10
 * characters, red when over budget.
 *
 * @param ctx - Session context (used to inspect the draft so far)
 * @param subject - Subject string as currently entered (may be empty)
 * @returns Prompt label
 */
function renderSubjectMessage(ctx: SessionContext, subject: string): string {
  const budget = ctx.config.headerMaxLength
  if (budget === null) return 'Subject:'
  const used = countHeaderLength({ type: ctx.draft.type, scope: ctx.draft.scope } as CommitDraft, subject)
  const remaining = budget - used
  const countText = remaining < 0 ? `${-remaining} over ${budget}-char header` : `${remaining} chars left in ${budget}-char header`
  return `Subject (${colorize(remaining, countText)}):`
}

/**
 * Colors the countdown string according to remaining header budget
 * (decision D11: green → yellow → red).
 *
 * @param remaining - Characters remaining in the header budget
 * @param text - Pre-formatted countdown label to color
 * @returns Styled countdown string
 */
function colorize(remaining: number, text: string): string {
  if (remaining < 0) return style.red(text)
  if (remaining <= 10) return style.yellow(text)
  return style.green(text)
}
