import type { CommitFooter } from '../../models/conventional'
import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { confirm, text, PromptResult } from '@hyperfrontend/questions'
import { cancelled, done } from '../models/step'
import { omitKeys } from './utils/omit'

/**
 * Step that optionally collects issue references (e.g. `fixes #123, re #456`)
 * and appends them to `draft.footers` using the ` #` separator form.
 *
 * The step is additive: existing footers stay, and any breaking-change footer
 * synthesized later by the formatter is unaffected.
 */
export const issuesStep: Step = {
  id: 'issues',
  async run(ctx: SessionContext): Promise<StepResult> {
    const confirmOutcome = await confirm({
      message: 'Does this change reference any issues?',
      initial: hasIssueFooter(ctx.draft.footers),
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (confirmOutcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    if (!confirmOutcome.value) {
      ctx.draft = stripIssueFooters(ctx.draft)
      return done()
    }

    const textOutcome = await text({
      message: 'Issue references (e.g. fixes #123, re #456):',
      validate: (value: string) => (parseReferences(value).length === 0 ? 'Enter at least one reference like "fixes #123"' : undefined),
      ...(ctx.config.input && { input: ctx.config.input }),
      ...(ctx.config.output && { output: ctx.config.output }),
    })

    if (textOutcome.result === PromptResult.Cancelled) {
      return cancelled()
    }

    ctx.draft = applyIssueFooters(ctx.draft, parseReferences(textOutcome.value))
    return done()
  },
}

/**
 * Parses a free-form references string into issue footers. Accepts commas,
 * semicolons, or whitespace between entries; ignores tokens that don't match
 * the `keyword #number` shape.
 *
 * @param raw - Raw user input from the issues prompt
 * @returns Footers matching each recognized reference
 *
 * @example Parsing a mixed references string
 * ```typescript
 * parseReferences('fixes #123, re #456')
 * // => [
 * //   { key: 'Fixes', value: '123', separator: ' #' },
 * //   { key: 'Re', value: '456', separator: ' #' },
 * // ]
 * ```
 */
export function parseReferences(raw: string): readonly CommitFooter[] {
  const footers: CommitFooter[] = []
  const length = raw.length
  let pos = 0
  while (pos < length) {
    const code = raw.charCodeAt(pos)
    if (!isLetter(code)) {
      pos++
      continue
    }
    const keywordStart = pos
    pos++
    while (pos < length && (isLetter(raw.charCodeAt(pos)) || raw.charCodeAt(pos) === HYPHEN)) {
      pos++
    }
    const keyword = raw.slice(keywordStart, pos)
    while (pos < length && isWhitespace(raw.charCodeAt(pos))) {
      pos++
    }
    if (pos >= length || raw.charCodeAt(pos) !== HASH) continue
    pos++
    const numberStart = pos
    while (pos < length && isDigit(raw.charCodeAt(pos))) {
      pos++
    }
    if (pos === numberStart) continue
    footers.push({ key: capitalize(keyword), value: raw.slice(numberStart, pos), separator: ' #' })
  }
  return footers
}

const HASH = 35
const HYPHEN = 45

/**
 * Returns true when `code` is an ASCII digit (`0`-`9`).
 *
 * @param code - Character code under test
 * @returns Whether the code falls within the digit range
 */
function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

/**
 * Returns true when `code` is an ASCII letter (`A`-`Z` or `a`-`z`).
 *
 * @param code - Character code under test
 * @returns Whether the code falls within the letter ranges
 */
function isLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

/**
 * Returns true when `code` is ASCII whitespace recognised by the input
 * tolerance window: space, tab, newline, or carriage return.
 *
 * @param code - Character code under test
 * @returns Whether the code is whitespace
 */
function isWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13
}

/**
 * Returns true when the draft already holds at least one issue footer
 * (anything using the ` #` separator form).
 *
 * @param footers - Current draft footers (may be undefined)
 * @returns True when there is at least one issue footer
 */
function hasIssueFooter(footers: readonly CommitFooter[] | undefined): boolean {
  if (!footers) return false
  return footers.some((footer) => footer.separator === ' #')
}

/**
 * Replaces any existing issue footers on the draft with the supplied set,
 * preserving footers that use the `:` separator (e.g. `BREAKING CHANGE:`).
 *
 * @param draft - Draft to update
 * @param newIssueFooters - Issue footers parsed from user input
 * @returns Updated draft
 */
function applyIssueFooters(draft: SessionContext['draft'], newIssueFooters: readonly CommitFooter[]): SessionContext['draft'] {
  const preserved = (draft.footers ?? []).filter((footer) => footer.separator !== ' #')
  return { ...draft, footers: [...preserved, ...newIssueFooters] }
}

/**
 * Removes issue footers from the draft while keeping any colon-separated
 * footers (e.g. `BREAKING CHANGE:`).
 *
 * @param draft - Draft to clean
 * @returns Updated draft
 */
function stripIssueFooters(draft: SessionContext['draft']): SessionContext['draft'] {
  if (!draft.footers) return draft
  const preserved = draft.footers.filter((footer) => footer.separator !== ' #')
  if (preserved.length === draft.footers.length) return draft
  if (preserved.length === 0) return omitKeys(draft, ['footers'])
  return { ...draft, footers: preserved }
}

/**
 * Capitalizes the first letter of an issue keyword so footers read as
 * `Fixes #123` rather than `fixes #123`.
 *
 * @param keyword - Raw keyword token from user input
 * @returns Keyword with the first letter uppercased
 */
function capitalize(keyword: string): string {
  const first = keyword.charAt(0).toUpperCase()
  return first + keyword.slice(1).toLowerCase()
}
