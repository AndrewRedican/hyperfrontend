import type { ChangelogEntry } from './entry'

/**
 * Changelog Link
 *
 * Represents a link defined in the changelog header or elsewhere.
 */
export interface ChangelogLink {
  /** Link label */
  readonly label: string

  /** Link URL */
  readonly url: string
}

/**
 * Changelog Header
 *
 * The header section of a changelog file.
 */
export interface ChangelogHeader {
  /** Title (e.g., "# Changelog") */
  readonly title: string

  /** Description paragraphs between title and first entry */
  readonly description: readonly string[]

  /** Any links defined in header */
  readonly links: readonly ChangelogLink[]
}

/**
 * Changelog Format
 *
 * Detected format/style of the changelog file.
 */
export type ChangelogFormat =
  | 'keep-a-changelog' // https://keepachangelog.com
  | 'conventional' // conventional-changelog
  | 'custom' // Non-standard format
  | 'unknown' // Could not determine

/**
 * Changelog Metadata
 *
 * Additional information extracted during parsing.
 */
export interface ChangelogMetadata {
  /** Detected changelog format/style */
  readonly format: ChangelogFormat

  /** Whether the file follows conventional changelog spec */
  readonly isConventional: boolean

  /** Repository URL if detected */
  readonly repositoryUrl?: string

  /** Package name if detected */
  readonly packageName?: string

  /** Parser warnings/notes */
  readonly warnings: readonly string[]
}

/**
 * Changelog
 *
 * Complete representation of a CHANGELOG.md file.
 * Designed for lossless round-tripping: parse -> modify -> serialize.
 */
export interface Changelog {
  /** Original file path (if parsed from file) */
  readonly source?: string

  /** File header/preamble content */
  readonly header: ChangelogHeader

  /** Version entries, ordered newest first */
  readonly entries: readonly ChangelogEntry[]

  /** Additional metadata extracted during parsing */
  readonly metadata: ChangelogMetadata
}

/**
 * Creates a new changelog with default values.
 *
 * @param options - Optional configuration to customize the changelog
 * @returns A new Changelog object with the specified options or defaults
 */
export function createChangelog(options?: Partial<Changelog>): Changelog {
  return {
    source: options?.source,
    header: options?.header ?? {
      title: '# Changelog',
      description: [],
      links: [],
    },
    entries: options?.entries ?? [],
    metadata: options?.metadata ?? {
      format: 'unknown',
      isConventional: false,
      warnings: [],
    },
  }
}

/**
 * Creates a new empty changelog with standard header.
 *
 * @returns A new empty Changelog with Keep a Changelog format
 */
export function createEmptyChangelog(): Changelog {
  return {
    header: {
      title: '# Changelog',
      description: [
        'All notable changes to this project will be documented in this file.',
        '',
        'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),',
        'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
      ],
      links: [],
    },
    entries: [],
    metadata: {
      format: 'keep-a-changelog',
      isConventional: false,
      warnings: [],
    },
  }
}

/**
 * Creates a changelog link.
 *
 * @param label - The display text for the link
 * @param url - The URL the link points to
 * @returns A new ChangelogLink object
 */
export function createChangelogLink(label: string, url: string): ChangelogLink {
  return { label, url }
}
