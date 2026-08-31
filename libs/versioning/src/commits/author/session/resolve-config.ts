import type { PartialSessionConfig, SessionConfig, SessionType } from '../models/session-config'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { conventionalPreset as conventionalRuleset, CONVENTIONAL_TYPES } from '../../validate/presets/conventional'
import { DEFAULT_IMPERATIVE_WORDLIST } from '../../validate/rules/imperative-mood'
import { getStagedPaths } from '../resolvers/staged-paths'

const TYPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  feat: 'A new feature',
  fix: 'A bug fix',
  docs: 'Documentation only changes',
  style: 'Changes that do not affect meaning (white-space, formatting, etc.)',
  refactor: 'A code change that neither fixes a bug nor adds a feature',
  perf: 'A code change that improves performance',
  test: 'Adding missing tests or correcting existing tests',
  build: 'Changes that affect the build system or external dependencies',
  ci: 'Changes to our CI configuration files and scripts',
  chore: 'Other changes that do not modify src or test files',
  revert: 'Reverts a previous commit',
}

/**
 * Default type enum rendered by the `type` step when the caller does not
 * supply their own list. Each conventional type is paired with a short hint.
 */
export const DEFAULT_SESSION_TYPES: readonly SessionType[] = freeze(
  CONVENTIONAL_TYPES.map((name) => ({ name, description: describeType(name) }) as const)
)

/**
 * Overlays a partial config over the built-in defaults, producing a fully
 * populated `SessionConfig` usable by the runner.
 *
 * @param overrides - Partial config supplied by the caller (may be undefined)
 * @returns Fully resolved configuration
 *
 * @example Resolving with no overrides
 * ```typescript
 * resolveSessionConfig()
 * // => { types: DEFAULT_SESSION_TYPES, scopeOptional: false, ... }
 * ```
 */
export function resolveSessionConfig(overrides: PartialSessionConfig = {}): SessionConfig {
  return {
    types: overrides.types ?? DEFAULT_SESSION_TYPES,
    ...(overrides.scopeFilter && { scopeFilter: overrides.scopeFilter }),
    scopeOptional: overrides.scopeOptional ?? false,
    scopeMulti: overrides.scopeMulti ?? false,
    stagedPathsProvider: overrides.stagedPathsProvider ?? getStagedPaths,
    cwd: overrides.cwd ?? process.cwd(),
    headerMaxLength: overrides.headerMaxLength !== undefined ? overrides.headerMaxLength : 72,
    imperativeWordlist: overrides.imperativeWordlist ?? DEFAULT_IMPERATIVE_WORDLIST,
    skipCommit: overrides.skipCommit ?? false,
    ...(overrides.commitExecutor && { commitExecutor: overrides.commitExecutor }),
    validateRuleset: overrides.validateRuleset ?? conventionalRuleset,
    ...(overrides.input && { input: overrides.input }),
    ...(overrides.output && { output: overrides.output }),
  }
}

/**
 * Maps a conventional type identifier to the short descriptor used by the
 * `type` prompt as an inline hint.
 *
 * @param name - Conventional type identifier (e.g. `feat`)
 * @returns One-line hint shown in the select prompt
 */
function describeType(name: string): string {
  return TYPE_DESCRIPTIONS[name] ?? ''
}
