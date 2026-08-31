/** Conventional commit type identifier (e.g., 'feat', 'fix', 'docs'). */
export type CommitType = 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'build' | 'ci' | 'chore' | 'revert' | string

export const COMMIT_TYPES = {
  feat: { description: 'A new feature', semverBump: 'minor' },
  fix: { description: 'A bug fix', semverBump: 'patch' },
  docs: { description: 'Documentation only changes', semverBump: 'none' },
  style: { description: 'Code style changes (formatting, etc.)', semverBump: 'none' },
  refactor: { description: 'Code refactoring without feature or fix', semverBump: 'none' },
  perf: { description: 'Performance improvements', semverBump: 'patch' },
  test: { description: 'Adding or updating tests', semverBump: 'none' },
  build: { description: 'Build system or dependencies', semverBump: 'none' },
  ci: { description: 'CI/CD configuration', semverBump: 'none' },
  chore: { description: 'Other changes', semverBump: 'none' },
  revert: { description: 'Revert a previous commit', semverBump: 'patch' },
} as const

export const RELEASE_TYPES = ['feat', 'fix', 'perf', 'revert'] as const
export const MINOR_TYPES = ['feat'] as const
export const PATCH_TYPES = ['fix', 'perf', 'revert'] as const

/**
 * Checks if a commit type is a standard type.
 *
 * @param type - The commit type to check
 * @returns True if the type is a standard conventional commit type
 *
 * @example Checking for standard commit types
 * ```typescript
 * isStandardType('feat')
 * // => true
 *
 * isStandardType('custom')
 * // => false
 * ```
 */
export function isStandardType(type: string): type is CommitType {
  return type in COMMIT_TYPES
}

/**
 * Checks if a commit type triggers a release.
 *
 * @param type - The commit type to check
 * @returns True if the type triggers a release
 *
 * @example Checking for release-triggering types
 * ```typescript
 * isReleaseType('feat')
 * // => true
 *
 * isReleaseType('chore')
 * // => false
 * ```
 */
export function isReleaseType(type: string): boolean {
  return (RELEASE_TYPES as ReadonlyArray<string>).includes(type)
}

/**
 * Gets the semver bump level for a commit type.
 * Returns 'none' for types that don't trigger a bump.
 *
 * @param type - The commit type
 * @param breaking - Whether this is a breaking change
 * @returns The semver bump level ('major', 'minor', 'patch', or 'none')
 *
 * @example Determining semver bump level
 * ```typescript
 * getSemverBump('feat', false)
 * // => 'minor'
 *
 * getSemverBump('fix', true)
 * // => 'major'
 *
 * getSemverBump('docs', false)
 * // => 'none'
 * ```
 */
export function getSemverBump(type: string, breaking: boolean): 'major' | 'minor' | 'patch' | 'none' {
  if (breaking) return 'major'

  const info = COMMIT_TYPES[type as keyof typeof COMMIT_TYPES]
  return info?.semverBump ?? 'none'
}
