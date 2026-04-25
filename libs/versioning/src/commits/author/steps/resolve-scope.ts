import type { SessionContext } from '../models/session-context'
import type { Step, StepResult } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { cancelled, done } from '../models/step'
import { defaultScope } from '../resolvers/default-scope'
import { discoverScopes } from '../resolvers/scope-discovery'

/** Error thrown to the runner when the staging area is empty. */
export const EMPTY_STAGING_MESSAGE = 'No staged changes; stage something first.'

/**
 * Non-prompt step that computes the candidate scope list and default scope.
 *
 * Calls `config.stagedPathsProvider()` → `discoverScopes` → `defaultScope` and
 * writes the results into the context. Cancels the session when the staging
 * area is empty (decision E1a).
 *
 * @example Populating the context from staged files
 * ```typescript
 * await resolveScopeStep.run(ctx)
 * // ctx.candidateScopes === [...discovered]
 * // ctx.defaultScope    === 'alpha' | undefined
 * ```
 */
export const resolveScopeStep: Step = {
  id: 'resolve-scope',
  async run(ctx): Promise<StepResult> {
    return runResolveScope(ctx)
  },
}

/**
 * Implementation extracted for direct testing. Returns the same `StepResult`
 * shape as `resolveScopeStep.run`.
 *
 * @param ctx - Session context to populate
 * @returns Step result (cancelled when staging is empty, done otherwise)
 */
function runResolveScope(ctx: SessionContext): StepResult {
  const stagedPaths = ctx.config.stagedPathsProvider({ cwd: ctx.config.cwd })
  if (stagedPaths.length === 0) {
    return cancelled(createError(EMPTY_STAGING_MESSAGE))
  }

  const scopeFilter = ctx.config.scopeFilter
  const discovered = discoverScopes(stagedPaths, {
    cwd: ctx.config.cwd,
    ...(scopeFilter && { scopeFilter }),
  })
  ctx.candidateScopes = discovered.map((entry) => entry.name)
  ctx.defaultScope = defaultScope(discovered)

  return done()
}
