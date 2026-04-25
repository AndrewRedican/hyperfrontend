import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Session outcome status constants. */
export const SessionStatus = freeze(<const>{
  /** Session ran to completion and (when `skipCommit === false`) created a commit */
  Committed: 'committed',
  /** Session terminated early (user Ctrl-C, empty staging refusal, commit failure) */
  Cancelled: 'cancelled',
})

/** Session outcome status values. */
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

/** Terminal outcome returned by `runAuthorSession`. */
export interface SessionOutcome {
  /** Status tag describing how the session ended */
  readonly status: SessionStatus

  /** Formatted commit message (populated whenever the draft reached the preview step) */
  readonly message?: string

  /** Error attached when the session cancelled due to an explicit failure */
  readonly error?: Error
}
