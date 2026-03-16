/**
 * Changelog Serialization Templates
 *
 * Output templates and formatting helpers for changelog serialization.
 * Provides configurable options for different changelog styles.
 */

import type { ChangelogSectionType } from '../models/section'
import { SECTION_HEADINGS } from '../models/section'

/**
 * Serialization options for controlling output format.
 */
export interface SerializeOptions {
  /** Include preamble description in header */
  readonly includeDescription?: boolean

  /** Include links section */
  readonly includeLinks?: boolean

  /** Include compare URLs for entries */
  readonly includeCompareUrls?: boolean

  /** Include commit references */
  readonly includeCommits?: boolean

  /** Include issue/PR references */
  readonly includeReferences?: boolean

  /** Include scope in items */
  readonly includeScope?: boolean

  /** Include raw content fallback */
  readonly includeRawContent?: boolean

  /** Section ordering (defaults to standard order) */
  readonly sectionOrder?: readonly ChangelogSectionType[]

  /** Custom section headings (overrides defaults) */
  readonly sectionHeadings?: Partial<Record<ChangelogSectionType, string>>

  /** Line ending style */
  readonly lineEnding?: '\n' | '\r\n'

  /** Number of blank lines between entries */
  readonly entrySpacing?: number

  /** Number of blank lines between sections */
  readonly sectionSpacing?: number

  /** Use asterisks (*) instead of dashes (-) for list items */
  readonly useAsterisks?: boolean
}

/**
 * Default serialization options.
 */
export const DEFAULT_SERIALIZE_OPTIONS: Required<SerializeOptions> = {
  includeDescription: true,
  includeLinks: true,
  includeCompareUrls: true,
  includeCommits: true,
  includeReferences: true,
  includeScope: true,
  includeRawContent: false,
  sectionOrder: [
    'breaking',
    'features',
    'fixes',
    'performance',
    'documentation',
    'deprecations',
    'refactoring',
    'tests',
    'build',
    'ci',
    'chores',
    'other',
  ],
  sectionHeadings: {},
  lineEnding: '\n',
  entrySpacing: 1,
  sectionSpacing: 1,
  useAsterisks: false,
}

/**
 * Merges user options with defaults.
 *
 * @param options - User-provided options
 * @returns Complete options with defaults applied
 */
export function resolveOptions(options?: SerializeOptions): Required<SerializeOptions> {
  if (!options) {
    return DEFAULT_SERIALIZE_OPTIONS
  }

  return {
    includeDescription: options.includeDescription ?? DEFAULT_SERIALIZE_OPTIONS.includeDescription,
    includeLinks: options.includeLinks ?? DEFAULT_SERIALIZE_OPTIONS.includeLinks,
    includeCompareUrls: options.includeCompareUrls ?? DEFAULT_SERIALIZE_OPTIONS.includeCompareUrls,
    includeCommits: options.includeCommits ?? DEFAULT_SERIALIZE_OPTIONS.includeCommits,
    includeReferences: options.includeReferences ?? DEFAULT_SERIALIZE_OPTIONS.includeReferences,
    includeScope: options.includeScope ?? DEFAULT_SERIALIZE_OPTIONS.includeScope,
    includeRawContent: options.includeRawContent ?? DEFAULT_SERIALIZE_OPTIONS.includeRawContent,
    sectionOrder: options.sectionOrder ?? DEFAULT_SERIALIZE_OPTIONS.sectionOrder,
    sectionHeadings: options.sectionHeadings ?? DEFAULT_SERIALIZE_OPTIONS.sectionHeadings,
    lineEnding: options.lineEnding ?? DEFAULT_SERIALIZE_OPTIONS.lineEnding,
    entrySpacing: options.entrySpacing ?? DEFAULT_SERIALIZE_OPTIONS.entrySpacing,
    sectionSpacing: options.sectionSpacing ?? DEFAULT_SERIALIZE_OPTIONS.sectionSpacing,
    useAsterisks: options.useAsterisks ?? DEFAULT_SERIALIZE_OPTIONS.useAsterisks,
  }
}

/**
 * Gets the heading for a section type, respecting custom headings.
 *
 * @param type - The changelog section type to get the heading for
 * @param customHeadings - Optional map of custom section type to heading overrides
 * @returns The heading string to use
 */
export function getSectionHeading(type: ChangelogSectionType, customHeadings?: Partial<Record<ChangelogSectionType, string>>): string {
  return customHeadings?.[type] ?? SECTION_HEADINGS[type]
}

/**
 * Creates a markdown link.
 *
 * @param text - The display text for the link
 * @param url - The destination URL for the link
 * @returns Formatted markdown link
 */
export function formatLink(text: string, url: string): string {
  return `[${text}](${url})`
}

/**
 * Creates a list item marker.
 *
 * @param useAsterisks - Whether to use * instead of -
 * @returns The list item marker ('- ' or '* ')
 */
export function getListMarker(useAsterisks: boolean): string {
  return useAsterisks ? '* ' : '- '
}

/**
 * Creates blank lines for spacing.
 *
 * @param count - Number of blank lines
 * @param lineEnding - Line ending style
 * @returns String with specified number of blank lines
 */
export function createSpacing(count: number, lineEnding: string): string {
  if (count <= 0) return ''
  return lineEnding.repeat(count)
}
