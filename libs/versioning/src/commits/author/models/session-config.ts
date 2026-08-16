import type { Choice } from '@hyperfrontend/questions'
import type { Ruleset } from '../../validate/models/ruleset'

/** Conventional-commit type entry shown in the `type` step's choice list. */
export interface SessionType {
  /** Bare identifier (e.g. `feat`, `fix`) */
  readonly name: string

  /** Short description rendered as a prompt hint */
  readonly description?: string
}

/** Signature for the scope filter passed in `SessionConfig.scopeFilter`. */
export interface ScopeFilterContext {
  /** Absolute path to the discovered project root */
  readonly path: string

  /** `name` field read from `project.json` (or `package.json` as fallback) */
  readonly name: string
}

/** Signature for executing the final git commit. */
export type CommitExecutor = (message: string) => void | Promise<void>

/** Options passed to the `StagedPathsProvider`. */
export interface StagedPathsProviderOptions {
  /** Working directory used for git operations and scope discovery */
  readonly cwd: string
}

/** Signature for resolving the staged file paths the session operates on. */
export type StagedPathsProvider = (options: StagedPathsProviderOptions) => readonly string[]

/**
 * Fully resolved authoring session configuration. Consumers typically supply a
 * partial shape: the config loader (or `createAuthorSession`) fills the gaps
 * with defaults before handing the result to the runner.
 */
export interface SessionConfig {
  /** Commit type enum shown in the `type` step */
  readonly types: readonly SessionType[]

  /** Optional filter applied to discovered scopes; receives `{ path, name }` */
  readonly scopeFilter?: (context: ScopeFilterContext) => boolean

  /** When true, the `scope` step may be skipped even if no candidates are found */
  readonly scopeOptional: boolean

  /** When true, the `scope` step collects multiple scopes via multiselect */
  readonly scopeMulti: boolean

  /** Resolver for the staged file list; defaults to `git diff --cached --name-only -z` */
  readonly stagedPathsProvider: StagedPathsProvider

  /** Working directory used for git operations and scope discovery */
  readonly cwd: string

  /** Maximum header length used by the subject countdown (null disables) */
  readonly headerMaxLength: number | null

  /** Wordlist used by the imperative-mood rule in inline validation */
  readonly imperativeWordlist: Readonly<Record<string, string>>

  /** When true, the final `commit` step is a no-op (session returns the message only) */
  readonly skipCommit: boolean

  /** Overrides the default `git commit` executor */
  readonly commitExecutor?: CommitExecutor

  /** Validation ruleset used for inline and preview-time warnings */
  readonly validateRuleset: Ruleset

  /** Optional stream override passed to every prompt in the session */
  readonly input?: NodeJS.ReadStream

  /** Optional stream override passed to every prompt in the session */
  readonly output?: NodeJS.WriteStream
}

/** Partial shape accepted by `createAuthorSession`/`loadCommitConfig`. */
export type PartialSessionConfig = Partial<SessionConfig>

/**
 * Maps a `SessionType` to a `Choice` usable by the `select` prompt.
 *
 * @param type - Session type entry to render as a selectable choice
 * @returns Choice with the type name as both label and value, plus an optional hint
 *
 * @example Rendering the feat type as a select choice
 * ```typescript
 * typeToChoice({ name: 'feat', description: 'A new feature' })
 * // => { label: 'feat', value: 'feat', hint: 'A new feature' }
 * ```
 */
export function typeToChoice(type: SessionType): Choice<string> {
  return {
    label: type.name,
    value: type.name,
    ...(type.description && { hint: type.description }),
  }
}
