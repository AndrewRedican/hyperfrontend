import type { CommitSource } from '../../commits/classify'
import type { CommitRef, IssueRef } from './commit-ref'
import type { ChangelogSectionType } from './section'

/**
 * Changelog Item
 *
 * Represents an individual change within a changelog section.
 */
export interface ChangelogItem {
  /** Scope (e.g., "api", "cli") */
  readonly scope?: string

  /** Description of the change */
  readonly description: string

  /** Commit references */
  readonly commits: readonly CommitRef[]

  /** Issue/PR references */
  readonly references: readonly IssueRef[]

  /** Whether this is a breaking change */
  readonly breaking: boolean

  /** Classification source (for auditing/debugging) */
  readonly source?: CommitSource

  /** Whether this is an indirect change (dependency or infrastructure) */
  readonly indirect?: boolean
}

/**
 * Changelog Section
 *
 * Represents a category of changes (Features, Bug Fixes, etc.)
 */
export interface ChangelogSection {
  /** Section type (features, fixes, etc.) */
  readonly type: ChangelogSectionType

  /** Section heading as it appears in file */
  readonly heading: string

  /** Individual change items */
  readonly items: readonly ChangelogItem[]
}

/**
 * Changelog Entry
 *
 * Represents a single version entry in a changelog.
 */
export interface ChangelogEntry {
  /** Version string (e.g., "1.2.3") */
  readonly version: string

  /** Release date (ISO format or null for unreleased) */
  readonly date: string | null

  /** Whether this is an unreleased/upcoming section */
  readonly unreleased: boolean

  /** Compare URL (e.g., GitHub compare link) */
  readonly compareUrl?: string

  /** Grouped changes by category */
  readonly sections: readonly ChangelogSection[]

  /** Raw text for entries that couldn't be parsed structurally */
  readonly rawContent?: string
}

/**
 * Creates a new changelog item.
 *
 * @param description - The description text of the change
 * @param options - Optional configuration for scope, commits, references, and breaking flag
 * @returns A new ChangelogItem object
 *
 * @example
 * ```typescript
 * const item = createChangelogItem('Add user authentication', {
 *   scope: 'auth',
 *   breaking: false,
 *   references: [{ number: 42, type: 'issue' }],
 * })
 * ```
 */
export function createChangelogItem(description: string, options?: Partial<Omit<ChangelogItem, 'description'>>): ChangelogItem {
  return {
    description,
    scope: options?.scope,
    commits: options?.commits ?? [],
    references: options?.references ?? [],
    breaking: options?.breaking ?? false,
    source: options?.source,
    indirect: options?.indirect,
  }
}

/**
 * Creates a new changelog section.
 *
 * @param type - The type of section (features, fixes, breaking, etc.)
 * @param heading - The display heading for the section
 * @param items - Optional array of changelog items in this section
 * @returns A new ChangelogSection object
 *
 * @example
 * ```typescript
 * const section = createChangelogSection('features', 'Added', [
 *   createChangelogItem('New dashboard widget'),
 * ])
 * ```
 */
export function createChangelogSection(
  type: ChangelogSectionType,
  heading: string,
  items: readonly ChangelogItem[] = []
): ChangelogSection {
  return {
    type,
    heading,
    items,
  }
}

/**
 * Creates a new changelog entry.
 *
 * @param version - The version string (e.g., '1.0.0')
 * @param options - Optional configuration for date, sections, and other properties
 * @returns A new ChangelogEntry object
 *
 * @example
 * ```typescript
 * const entry = createChangelogEntry('1.0.0', {
 *   date: '2024-01-15',
 *   sections: [createChangelogSection('features', 'Added', items)],
 * })
 * ```
 */
export function createChangelogEntry(version: string, options?: Partial<Omit<ChangelogEntry, 'version'>>): ChangelogEntry {
  return {
    version,
    date: options?.date ?? null,
    unreleased: options?.unreleased ?? false,
    compareUrl: options?.compareUrl,
    sections: options?.sections ?? [],
    rawContent: options?.rawContent,
  }
}

/**
 * Creates an unreleased changelog entry.
 *
 * @param sections - Optional array of changelog sections
 * @returns A new ChangelogEntry object marked as unreleased
 *
 * @example
 * ```typescript
 * const unreleased = createUnreleasedEntry([
 *   createChangelogSection('features', 'Added', [item]),
 * ])
 * // => { version: 'Unreleased', date: null, unreleased: true, sections: [...] }
 * ```
 */
export function createUnreleasedEntry(sections: readonly ChangelogSection[] = []): ChangelogEntry {
  return {
    version: 'Unreleased',
    date: null,
    unreleased: true,
    sections,
  }
}
