import type { Ruleset } from '../models/ruleset'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Conventional Commits default type enum used by the preset. */
export const CONVENTIONAL_TYPES: readonly string[] = freeze(<const>[
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
])

/**
 * Default ruleset mirroring `@commitlint/config-conventional`'s baseline.
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
export const conventionalPreset: Ruleset = freeze(<const>{
  'type-enum': ['error', { types: CONVENTIONAL_TYPES }],
  'subject-empty': ['error'],
  'scope-enum': ['off'],
  'subject-case': ['off'],
  'header-max-length': ['warn', { maxLength: 72 }],
  'imperative-mood': ['warn'],
})
