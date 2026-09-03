import type { SessionConfig } from '../models/session-config'
import { conventionalPreset } from '../../validate/presets/conventional'
import { DEFAULT_IMPERATIVE_WORDLIST } from '../../validate/rules/imperative-mood'

/** Default types used by tests that don't care about the specific type enum. */
export const TEST_TYPES = [
  { name: 'feat', description: 'A new feature' },
  { name: 'fix', description: 'A bug fix' },
] as const

/**
 * Builds a fully-populated `SessionConfig` with test-friendly defaults. Tests
 * layer on their own overrides (streams, staged paths, executors) via
 * `overrides`.
 *
 * @param overrides - Partial config merged over the defaults
 * @returns Session config ready to feed `createSessionContext`
 *
 * @example Building a test config with a custom staged paths provider
 * ```typescript
 * const config = createTestConfig({ stagedPathsProvider: () => ['src/a.ts'] })
 * const ctx = createSessionContext(config)
 * ```
 */
export function createTestConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    types: TEST_TYPES,
    scopeOptional: false,
    scopeMulti: false,
    stagedPathsProvider: () => [],
    cwd: '/tmp',
    headerMaxLength: 72,
    imperativeWordlist: DEFAULT_IMPERATIVE_WORDLIST,
    skipCommit: true,
    validateRuleset: conventionalPreset,
    ...overrides,
  }
}
