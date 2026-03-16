/**
 * Changelog Section Types
 *
 * Categories for grouping changes in a changelog entry.
 */
export type ChangelogSectionType =
  | 'breaking'
  | 'features'
  | 'fixes'
  | 'performance'
  | 'documentation'
  | 'deprecations'
  | 'refactoring'
  | 'tests'
  | 'build'
  | 'ci'
  | 'chores'
  | 'other'

/**
 * Maps section headings to their canonical types.
 * Used during parsing to normalize different heading styles.
 */
export const SECTION_TYPE_MAP: Record<string, ChangelogSectionType> = {
  // Breaking changes
  'breaking changes': 'breaking',
  breaking: 'breaking',
  'breaking change': 'breaking',

  // Features
  features: 'features',
  feature: 'features',
  added: 'features',
  new: 'features',

  // Fixes
  fixes: 'fixes',
  fix: 'fixes',
  'bug fixes': 'fixes',
  bugfixes: 'fixes',
  fixed: 'fixes',

  // Performance
  performance: 'performance',
  'performance improvements': 'performance',
  perf: 'performance',

  // Documentation
  documentation: 'documentation',
  docs: 'documentation',

  // Deprecations
  deprecations: 'deprecations',
  deprecated: 'deprecations',

  // Refactoring
  refactoring: 'refactoring',
  refactor: 'refactoring',
  'code refactoring': 'refactoring',

  // Tests
  tests: 'tests',
  test: 'tests',
  testing: 'tests',

  // Build
  build: 'build',
  'build system': 'build',
  dependencies: 'build',

  // CI
  ci: 'ci',
  'continuous integration': 'ci',

  // Chores
  chores: 'chores',
  chore: 'chores',
  maintenance: 'chores',

  // Other
  other: 'other',
  miscellaneous: 'other',
  misc: 'other',
  changed: 'other',
  changes: 'other',
  removed: 'other',
  security: 'other',
}

/**
 * Standard section headings for serialization.
 * Maps section types to their preferred heading text.
 */
export const SECTION_HEADINGS: Record<ChangelogSectionType, string> = {
  breaking: 'Breaking Changes',
  features: 'Features',
  fixes: 'Bug Fixes',
  performance: 'Performance',
  documentation: 'Documentation',
  deprecations: 'Deprecations',
  refactoring: 'Refactoring',
  tests: 'Tests',
  build: 'Build',
  ci: 'CI',
  chores: 'Chores',
  other: 'Other',
}

/**
 * Determines the section type from a heading string.
 * Returns 'other' if the heading is not recognized.
 *
 * @param heading - The heading string to parse
 * @returns The corresponding ChangelogSectionType
 */
export function getSectionType(heading: string): ChangelogSectionType {
  const normalized = heading.toLowerCase().trim()
  return SECTION_TYPE_MAP[normalized] ?? 'other'
}
