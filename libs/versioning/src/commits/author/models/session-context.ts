import type { CommitDraft } from '../../format/models/draft'
import type { SessionConfig } from './session-config'

/**
 * Mutable container threaded through every step. The `draft` field accumulates
 * the in-progress commit message; `candidateScopes`/`defaultScope` are filled
 * by the `resolve-scope` step and consumed by later steps. `config` is the
 * fully resolved `SessionConfig` shared across the session.
 */
export interface SessionContext {
  /** In-progress commit draft accumulated as steps execute */
  draft: CommitDraft

  /** Scopes discovered from the staged file set (may be empty) */
  candidateScopes: readonly string[]

  /** Default scope pre-selected by the `scope` step (undefined = no default) */
  defaultScope: string | undefined

  /** Resolved configuration for the session */
  readonly config: SessionConfig
}

/**
 * Creates a fresh session context seeded with an empty draft.
 *
 * @param config - Resolved session configuration
 * @returns Session context ready for the first step
 *
 * @example Creating a bare context
 * ```typescript
 * createSessionContext(config)
 * // => { draft: {}, candidateScopes: [], defaultScope: undefined, config }
 * ```
 */
export function createSessionContext(config: SessionConfig): SessionContext {
  return {
    draft: {},
    candidateScopes: [],
    defaultScope: undefined,
    config,
  }
}
