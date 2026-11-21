import type { Ruleset } from '../models/ruleset'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Type enum used by the preset: the Conventional Commits defaults and `security`. */
export const CONVENTIONAL_TYPES: readonly string[] = freeze([
  'feat',
  'fix',
  'security',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const)

/**
 * Default ruleset mirroring `@commitlint/config-conventional`'s baseline, with `security` added to the types.
 *
 * | Rule               | Level | Options                  |
 * | ------------------ | ----- | ------------------------ |
 * | type-enum          | error | `CONVENTIONAL_TYPES`     |
 * | subject-empty      | error | —                        |
 * | scope-enum         | off   | —                        |
 * | subject-case       | off   | —                        |
 * | header-max-length  | warn  | `{ maxLength: 72 }`      |
 * | imperative-mood    | warn  | —                        |
 */
export const conventionalPreset: Ruleset = freeze({
  'type-enum': ['error', { types: CONVENTIONAL_TYPES }],
  'subject-empty': ['error'],
  'scope-enum': ['off'],
  'subject-case': ['off'],
  'header-max-length': ['warn', { maxLength: 72 }],
  'imperative-mood': ['warn'],
} as const)
