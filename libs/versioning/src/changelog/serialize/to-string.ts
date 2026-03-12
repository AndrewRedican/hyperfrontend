/**
 * Changelog Serialization to String
 *
 * Converts a Changelog object back to markdown format.
 * Supports configurable output formatting for different changelog styles.
 */

import type { Changelog, ChangelogHeader, ChangelogLink } from '../models/changelog'
import type { CommitRef, IssueRef } from '../models/commit-ref'
import type { ChangelogEntry, ChangelogItem, ChangelogSection } from '../models/entry'
import type { ChangelogSectionType } from '../models/section'
import type { SerializeOptions } from './templates'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { resolveOptions, getSectionHeading, formatLink, getListMarker, createSpacing } from './templates'

/**
 * Serializes a Changelog object to markdown string.
 *
 * @param changelog - The changelog to serialize
 * @param options - Optional serialization options
 * @returns The markdown string representation
 *
 * @example
 * ```ts
 * const markdown = serializeChangelog(changelog)
 * ```
 *
 * @example
 * ```ts
 * const markdown = serializeChangelog(changelog, {
 *   includeCommits: false,
 *   useAsterisks: true,
 * })
 * ```
 */
export function serializeChangelog(changelog: Changelog, options?: SerializeOptions): string {
  const opts = resolveOptions(options)
  const parts: string[] = []

  // Serialize header
  parts.push(serializeHeader(changelog.header, opts))

  // Serialize entries
  for (let i = 0; i < changelog.entries.length; i++) {
    const entry = changelog.entries[i]
    parts.push(serializeEntry(entry, opts))

    // Add spacing between entries (except after the last one)
    if (i < changelog.entries.length - 1) {
      parts.push(createSpacing(opts.entrySpacing, opts.lineEnding))
    }
  }

  return parts.join('')
}

/**
 * Serializes the changelog header.
 *
 * @param header - The header to serialize
 * @param opts - Resolved options
 * @returns The serialized header string
 */
function serializeHeader(header: ChangelogHeader, opts: Required<SerializeOptions>): string {
  const parts: string[] = []
  const nl = opts.lineEnding

  // Title
  parts.push(header.title + nl)
  parts.push(nl)

  // Description
  if (opts.includeDescription && header.description.length > 0) {
    for (const line of header.description) {
      parts.push(line + nl)
    }
    parts.push(nl)
  }

  // Links section
  if (opts.includeLinks && header.links.length > 0) {
    for (const link of header.links) {
      parts.push(serializeLink(link) + nl)
    }
    parts.push(nl)
  }

  return parts.join('')
}

/**
 * Serializes a changelog link.
 *
 * @param link - The link to serialize
 * @returns The serialized link
 */
function serializeLink(link: ChangelogLink): string {
  return `[${link.label}]: ${link.url}`
}

/**
 * Serializes a changelog entry.
 *
 * @param entry - The entry to serialize
 * @param opts - Resolved options
 * @returns The serialized entry string
 */
function serializeEntry(entry: ChangelogEntry, opts: Required<SerializeOptions>): string {
  const parts: string[] = []
  const nl = opts.lineEnding

  // Entry heading
  parts.push(serializeEntryHeading(entry, opts) + nl)
  parts.push(nl)

  // Raw content fallback
  if (opts.includeRawContent && entry.rawContent) {
    parts.push(entry.rawContent + nl)
    return parts.join('')
  }

  // Sort sections by specified order
  const sortedSections = sortSections(entry.sections, opts.sectionOrder)

  // Serialize sections
  for (let i = 0; i < sortedSections.length; i++) {
    const section = sortedSections[i]
    parts.push(serializeSection(section, opts))

    // Add spacing between sections (except after the last one)
    if (i < sortedSections.length - 1) {
      parts.push(createSpacing(opts.sectionSpacing, nl))
    }
  }

  return parts.join('')
}

/**
 * Serializes an entry heading.
 *
 * @param entry - The changelog entry to serialize the heading for
 * @param opts - Resolved serialization options
 * @returns The heading line
 */
function serializeEntryHeading(entry: ChangelogEntry, opts: Required<SerializeOptions>): string {
  const parts: string[] = ['## ']

  // Version with optional compare URL
  if (opts.includeCompareUrls && entry.compareUrl) {
    parts.push(formatLink(entry.version, entry.compareUrl))
  } else {
    parts.push(entry.version)
  }

  // Date
  if (entry.date) {
    parts.push(` - ${entry.date}`)
  }

  return parts.join('')
}

/**
 * Sorts sections by the specified order.
 *
 * @param sections - The sections to sort
 * @param order - The desired section order
 * @returns Sorted sections
 */
function sortSections(sections: readonly ChangelogSection[], order: readonly ChangelogSectionType[]): readonly ChangelogSection[] {
  const orderMap = createMap<ChangelogSectionType, number>()
  order.forEach((type, index) => orderMap.set(type, index))

  return [...sections].sort((a, b) => {
    const orderA = orderMap.get(a.type) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderMap.get(b.type) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

/**
 * Serializes a changelog section.
 *
 * @param section - The section to serialize
 * @param opts - Resolved options
 * @returns The serialized section string
 */
function serializeSection(section: ChangelogSection, opts: Required<SerializeOptions>): string {
  const parts: string[] = []
  const nl = opts.lineEnding

  // Section heading - use original heading if available, otherwise generate
  const heading = section.heading || getSectionHeading(section.type, opts.sectionHeadings)
  parts.push(`### ${heading}${nl}`)
  parts.push(nl)

  // Items
  for (const item of section.items) {
    parts.push(serializeItem(item, opts) + nl)
  }

  return parts.join('')
}

/**
 * Serializes a changelog item.
 *
 * @param item - The item to serialize
 * @param opts - Resolved options
 * @returns The serialized item string
 */
function serializeItem(item: ChangelogItem, opts: Required<SerializeOptions>): string {
  const parts: string[] = []
  const marker = getListMarker(opts.useAsterisks)

  parts.push(marker)

  // Breaking change indicator
  if (item.breaking) {
    parts.push('**BREAKING** ')
  }

  // Scope
  if (opts.includeScope && item.scope) {
    parts.push(`**${item.scope}:** `)
  }

  // Description
  parts.push(item.description)

  // Commit references
  if (opts.includeCommits && item.commits.length > 0) {
    parts.push(' (')
    parts.push(item.commits.map(serializeCommitRef).join(', '))
    parts.push(')')
  }

  // Issue/PR references
  if (opts.includeReferences && item.references.length > 0) {
    const refs = item.references.map(serializeIssueRef).join(', ')
    parts.push(` ${refs}`)
  }

  return parts.join('')
}

/**
 * Serializes a commit reference.
 *
 * @param ref - The commit reference
 * @returns The serialized reference
 */
function serializeCommitRef(ref: CommitRef): string {
  if (ref.url) {
    return formatLink(ref.shortHash, ref.url)
  }
  return ref.shortHash
}

/**
 * Serializes an issue/PR reference.
 *
 * @param ref - The issue reference
 * @returns The serialized reference
 */
function serializeIssueRef(ref: IssueRef): string {
  const text = `#${ref.number}`
  if (ref.url) {
    return formatLink(text, ref.url)
  }
  return text
}
