import type { SessionOutcome } from '../models/session-outcome'
import type { Step } from '../models/step'
import type { AuthorSession } from './create-session'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { formatCommitMessage } from '../../format/format-message'
import { createSessionContext } from '../models/session-context'
import { SessionStatus } from '../models/session-outcome'
import { StepStatus } from '../models/step'

/**
 * Executes the session step-by-step. Handles `goto` jumps, surfaces Ctrl-C
 * cancellations as `{ status: 'cancelled' }` outcomes, and (on success)
 * returns the final formatted message alongside the `committed` status.
 *
 * @param session - Session description produced by `createAuthorSession`
 * @returns Terminal outcome describing how the session ended
 *
 * @example Running a session to completion
 * ```typescript
 * const session = createAuthorSession({ config: { skipCommit: true } })
 * const outcome = await runAuthorSession(session)
 * // => { status: 'committed', message: 'feat: ...' }
 * ```
 */
export async function runAuthorSession(session: AuthorSession): Promise<SessionOutcome> {
  const ctx = createSessionContext(session.config)
  const stepsById = indexStepsById(session.steps)

  for (let index = 0; index < session.steps.length; ) {
    const step = session.steps[index]
    if (step === undefined) break

    const result = await step.run(ctx)

    if (result.status === StepStatus.Cancelled) {
      return buildCancelled(result.error)
    }

    if (result.status === StepStatus.Goto) {
      const targetId = result.gotoStepId ?? ''
      const targetIndex = stepsById[targetId]
      if (targetIndex === undefined) {
        return buildCancelled(createError(`Unknown goto target: ${targetId || '<none>'}`))
      }
      index = targetIndex
      continue
    }

    index++
  }

  return { status: SessionStatus.Committed, message: formatCommitMessage(ctx.draft) }
}

/**
 * Builds an index map from step id to its position in the step list for
 * constant-time `goto` lookups.
 *
 * @param steps - Ordered step list being executed
 * @returns Map of step id → position
 */
function indexStepsById(steps: readonly Step[]): Readonly<Record<string, number>> {
  const map: Record<string, number> = {}
  steps.forEach((step, i) => {
    map[step.id] = i
  })
  return map
}

/**
 * Shapes a `cancelled` outcome, attaching the error only when one was
 * provided by the step.
 *
 * @param error - Optional error carried by the cancelling step
 * @returns Cancelled `SessionOutcome`
 */
function buildCancelled(error: Error | undefined): SessionOutcome {
  if (error) return { status: SessionStatus.Cancelled, error }
  return { status: SessionStatus.Cancelled }
}
