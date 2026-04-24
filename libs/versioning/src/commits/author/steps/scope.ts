import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { multiselect, select, PromptResult } from '@hyperfrontend/questions'
import { cancelled, done } from '../models/step'

/** Error thrown when the scope step cannot proceed because no candidates were found. */
export const NO_SCOPE_CANDIDATES_MESSAGE =
  'No scope candidates were discovered. Either stage a file under a project or set scopeOptional: true.'

/**
 * Step that prompts the user to pick the commit scope(s) from the candidate
 * list discovered by `resolve-scope`. Respects `scopeOptional` (cancels with
 * an actionable error when no candidates exist and scope is required) and
 * `scopeMulti` (multiselect vs. single-select).
 */
export const scopeStep: Step = {
  id: 'scope',
  async run(ctx: SessionContext): Promise<StepResult> {
    if (ctx.candidateScopes.length === 0) {
      if (ctx.config.scopeOptional) {
        ctx.draft = { ...ctx.draft, scope: [] }
        return done()
      }
      return cancelled(createError(NO_SCOPE_CANDIDATES_MESSAGE))
    }

    if (ctx.config.scopeMulti) {
      return runMultiselect(ctx)
    }
    return runSingleSelect(ctx)
  },
}

/**
 * Runs the single-select variant of the scope prompt.
 *
 * @param ctx - Session context
 * @returns Step result
 */
async function runSingleSelect(ctx: SessionContext): Promise<StepResult> {
  const choices = ctx.candidateScopes.map((name) => ({ label: name, value: name }))
  const initialIndex = resolveInitialIndex(ctx.candidateScopes, ctx.draft.scope, ctx.defaultScope)

  const outcome = await select({
    message: 'Select the scope of change:',
    choices,
    searchable: true,
    ...(initialIndex >= 0 && { initial: initialIndex }),
    ...(ctx.config.input && { input: ctx.config.input }),
    ...(ctx.config.output && { output: ctx.config.output }),
  })

  if (outcome.result === PromptResult.Cancelled) {
    return cancelled()
  }

  ctx.draft = { ...ctx.draft, scope: [outcome.value] }
  return done()
}

/**
 * Runs the multi-select variant of the scope prompt.
 *
 * @param ctx - Session context
 * @returns Step result
 */
async function runMultiselect(ctx: SessionContext): Promise<StepResult> {
  const choices = ctx.candidateScopes.map((name) => ({ label: name, value: name }))
  const draftScopes = ctx.draft.scope ?? []
  const initialIndices = ctx.candidateScopes.map((name, index) => (draftScopes.includes(name) ? index : -1)).filter((index) => index >= 0)

  const outcome = await multiselect({
    message: 'Select the scopes of change:',
    choices,
    searchable: true,
    ...(initialIndices.length > 0 && { initial: initialIndices }),
    ...(ctx.config.scopeOptional ? { min: 0 } : { min: 1 }),
    ...(ctx.config.input && { input: ctx.config.input }),
    ...(ctx.config.output && { output: ctx.config.output }),
  })

  if (outcome.result === PromptResult.Cancelled) {
    return cancelled()
  }

  ctx.draft = { ...ctx.draft, scope: outcome.value }
  return done()
}

/**
 * Resolves the initial cursor index for the single-select scope prompt.
 *
 * Priority: existing draft scope → discovered default scope → first entry.
 *
 * @param candidates - Ordered candidate scopes
 * @param draftScope - Scope already recorded on the draft (preview-restart path)
 * @param defaultScope - Default produced by `resolve-scope`
 * @returns Index into `candidates`, or -1 to leave the prompt unseeded
 */
function resolveInitialIndex(
  candidates: readonly string[],
  draftScope: readonly string[] | undefined,
  defaultScope: string | undefined
): number {
  const firstDraftScope = draftScope?.[0]
  if (firstDraftScope !== undefined) {
    const index = candidates.indexOf(firstDraftScope)
    if (index >= 0) return index
  }
  if (defaultScope !== undefined) {
    const index = candidates.indexOf(defaultScope)
    if (index >= 0) return index
  }
  return -1
}
