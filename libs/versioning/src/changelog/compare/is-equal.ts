import type { Changelog, ChangelogHeader, ChangelogLink, ChangelogMetadata } from '../models/changelog'
import type { CommitRef, IssueRef } from '../models/commit-ref'
import type { ChangelogEntry, ChangelogItem, ChangelogSection } from '../models/entry'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Checks if two changelogs are structurally identical.
 *
 * @param a - First changelog
 * @param b - Second changelog
 * @returns True if changelogs are identical
 *
 * @example
 * ```ts
 * if (isChangelogEqual(mainChangelog, branchChangelog)) {
 *   console.log('Changelogs are identical')
 * }
 * ```
 */
export function isChangelogEqual(a: Changelog, b: Changelog): boolean {
  if (a.source !== b.source) return false

  if (!isHeaderEqual(a.header, b.header)) return false

  if (a.entries.length !== b.entries.length) return false
  for (let i = 0; i < a.entries.length; i++) {
    const aEntry = a.entries[i]
    const bEntry = b.entries[i]
    if (aEntry === undefined || bEntry === undefined || !isEntryEqual(aEntry, bEntry)) return false
  }

  if (!isMetadataEqual(a.metadata, b.metadata)) return false

  return true
}

/**
 * Checks if two changelog headers are equal.
 *
 * @param a - First header
 * @param b - Second header
 * @returns True if headers are equal
 */
export function isHeaderEqual(a: ChangelogHeader, b: ChangelogHeader): boolean {
  if (a.title !== b.title) return false

  if (a.description.length !== b.description.length) return false
  for (let i = 0; i < a.description.length; i++) {
    if (a.description[i] !== b.description[i]) return false
  }

  if (a.links.length !== b.links.length) return false
  for (let i = 0; i < a.links.length; i++) {
    const aLink = a.links[i]
    const bLink = b.links[i]
    if (aLink === undefined || bLink === undefined || !isLinkEqual(aLink, bLink)) return false
  }

  return true
}

/**
 * Checks if two changelog links are equal.
 *
 * @param a - First link
 * @param b - Second link
 * @returns True if links are equal
 */
export function isLinkEqual(a: ChangelogLink, b: ChangelogLink): boolean {
  return a.label === b.label && a.url === b.url
}

/**
 * Checks if two changelog entries are equal.
 *
 * @param a - First entry
 * @param b - Second entry
 * @returns True if entries are equal
 */
export function isEntryEqual(a: ChangelogEntry, b: ChangelogEntry): boolean {
  if (a.version !== b.version) return false
  if (a.date !== b.date) return false
  if (a.unreleased !== b.unreleased) return false
  if (a.compareUrl !== b.compareUrl) return false
  if (a.rawContent !== b.rawContent) return false

  if (a.sections.length !== b.sections.length) return false
  for (let i = 0; i < a.sections.length; i++) {
    const aSection = a.sections[i]
    const bSection = b.sections[i]
    if (aSection === undefined || bSection === undefined || !isSectionEqual(aSection, bSection)) return false
  }

  return true
}

/**
 * Checks if two changelog sections are equal.
 *
 * @param a - First section
 * @param b - Second section
 * @returns True if sections are equal
 */
export function isSectionEqual(a: ChangelogSection, b: ChangelogSection): boolean {
  if (a.type !== b.type) return false
  if (a.heading !== b.heading) return false

  if (a.items.length !== b.items.length) return false
  for (let i = 0; i < a.items.length; i++) {
    const aItem = a.items[i]
    const bItem = b.items[i]
    if (aItem === undefined || bItem === undefined || !isItemEqual(aItem, bItem)) return false
  }

  return true
}

/**
 * Checks if two changelog items are equal.
 *
 * @param a - First item
 * @param b - Second item
 * @returns True if items are equal
 */
export function isItemEqual(a: ChangelogItem, b: ChangelogItem): boolean {
  if (a.scope !== b.scope) return false
  if (a.description !== b.description) return false
  if (a.breaking !== b.breaking) return false

  if (a.commits.length !== b.commits.length) return false
  for (let i = 0; i < a.commits.length; i++) {
    const aCommit = a.commits[i]
    const bCommit = b.commits[i]
    if (aCommit === undefined || bCommit === undefined || !isCommitRefEqual(aCommit, bCommit)) return false
  }

  if (a.references.length !== b.references.length) return false
  for (let i = 0; i < a.references.length; i++) {
    const aRef = a.references[i]
    const bRef = b.references[i]
    if (aRef === undefined || bRef === undefined || !isIssueRefEqual(aRef, bRef)) return false
  }

  return true
}

/**
 * Checks if two commit references are equal.
 *
 * @param a - First commit ref
 * @param b - Second commit ref
 * @returns True if commit refs are equal
 */
export function isCommitRefEqual(a: CommitRef, b: CommitRef): boolean {
  return a.hash === b.hash && a.shortHash === b.shortHash && a.url === b.url
}

/**
 * Checks if two issue references are equal.
 *
 * @param a - First issue ref
 * @param b - Second issue ref
 * @returns True if issue refs are equal
 */
export function isIssueRefEqual(a: IssueRef, b: IssueRef): boolean {
  return a.number === b.number && a.type === b.type && a.url === b.url
}

/**
 * Checks if two changelog metadata objects are equal.
 *
 * @param a - First metadata
 * @param b - Second metadata
 * @returns True if metadata are equal
 */
export function isMetadataEqual(a: ChangelogMetadata, b: ChangelogMetadata): boolean {
  if (a.format !== b.format) return false
  if (a.isConventional !== b.isConventional) return false
  if (a.repositoryUrl !== b.repositoryUrl) return false
  if (a.packageName !== b.packageName) return false

  if (a.warnings.length !== b.warnings.length) return false
  for (let i = 0; i < a.warnings.length; i++) {
    if (a.warnings[i] !== b.warnings[i]) return false
  }

  return true
}

/**
 * Checks if two changelogs have the same entries (by version).
 * Does not compare entry contents, only versions present.
 *
 * @param a - First changelog
 * @param b - Second changelog
 * @returns True if both changelogs have the same versions
 */
export function haveSameVersions(a: Changelog, b: Changelog): boolean {
  if (a.entries.length !== b.entries.length) return false

  const versionsA = createSet(a.entries.map((e) => e.version))
  const versionsB = createSet(b.entries.map((e) => e.version))

  if (versionsA.size !== versionsB.size) return false

  for (const version of versionsA) {
    if (!versionsB.has(version)) return false
  }

  return true
}

/**
 * Checks if a changelog contains a specific version.
 *
 * @param changelog - The changelog to search
 * @param version - The version to look for
 * @returns True if the version exists in the changelog
 */
export function hasVersion(changelog: Changelog, version: string): boolean {
  return changelog.entries.some((e) => e.version === version)
}

/**
 * Gets an entry by version from a changelog.
 *
 * @param changelog - The changelog to search
 * @param version - The version to find
 * @returns The entry if found, undefined otherwise
 */
export function getEntryByVersion(changelog: Changelog, version: string): ChangelogEntry | undefined {
  return changelog.entries.find((e) => e.version === version)
}
