/**
 * Changelog data structures and factory functions for entries, sections, and items.
 *
 * @module @hyperfrontend/versioning/changelog/models
 */
export type { Changelog, ChangelogFormat, ChangelogHeader, ChangelogLink, ChangelogMetadata } from './changelog'
export type { CommitRef, IssueRef } from './commit-ref'
export type { ChangelogEntry, ChangelogItem, ChangelogSection } from './entry'
export type { CompatibilityResult, SchemaDifference } from './schema'
export type { ChangelogSectionType } from './section'
export { createChangelog, createChangelogLink, createEmptyChangelog } from './changelog'
export { createCommitRef, createIssueRef, getShortHash } from './commit-ref'
export { createChangelogEntry, createChangelogItem, createChangelogSection, createUnreleasedEntry } from './entry'
export { changelogSchema, validateChangelog, checkSchemaCompatibility } from './schema'
export { getSectionType, SECTION_HEADINGS, SECTION_TYPE_MAP } from './section'
