/**
 * What kind of change a section of a release lists.
 *
 * The headings are the ones `@hyperfrontend/versioning` writes, folded to a
 * handful of kinds a page can style: a breaking change and a bug fix are not
 * the same shape of news.
 */
export type ChangelogSectionKind = 'breaking' | 'features' | 'fixes' | 'performance' | 'documentation' | 'other'

/** One line of a release's notes. */
export interface ChangelogItem {
  /** The note, as markdown, without its scope prefix or breaking marker */
  text: string
  /** The `**scope:**` prefix the note carried, when it carried one */
  scope: string | null
  /** Whether the note was marked as a breaking change */
  breaking: boolean
}

/** One heading's worth of notes inside a release. */
export interface ChangelogSection {
  /** The heading as written, `Bug Fixes` */
  heading: string
  /** The heading folded to a kind */
  kind: ChangelogSectionKind
  /** The notes under it */
  items: ChangelogItem[]
}

/** One published version. */
export interface ChangelogRelease {
  /** The version, `0.10.0` */
  version: string
  /** The release day, `2026-09-08`, or null when the heading carries none */
  date: string | null
  /** The compare link the heading wraps the version in, when it wraps it */
  compareUrl: string | null
  /** The notes, grouped as the file groups them */
  sections: ChangelogSection[]
}

/** Section headings, lower-cased, folded to their kind. */
const SECTION_KINDS: Record<string, ChangelogSectionKind> = {
  'breaking changes': 'breaking',
  breaking: 'breaking',
  features: 'features',
  added: 'features',
  'bug fixes': 'fixes',
  fixes: 'fixes',
  fixed: 'fixes',
  performance: 'performance',
  documentation: 'documentation',
  docs: 'documentation',
}

/** The prefix of a release heading, `## 1.2.3 - 2026-09-08` or `## [1.2.3](url) - 2026-09-08`. */
const RELEASE_PREFIX = '## '

/** The separator between a release heading's version and its date. */
const DATE_SEPARATOR = ' - '

/** A release day, `2026-09-08`. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** A section heading: `### Features`. */
const SECTION_HEADING = /^### (.+?)\s*$/

/** A note: `- text`, with an optional `**BREAKING**` marker and an optional `**scope:**` prefix. */
const ITEM_LINE = /^- (.*)$/

/** The marker `@hyperfrontend/versioning` writes in front of a breaking note. */
const BREAKING_MARKER = '**BREAKING** '

/** A `**scope:** ` prefix at the start of a note. */
const SCOPE_PREFIX = /^\*\*([^*]+):\*\*\s+/

/**
 * Fold a section heading to its kind.
 *
 * @param heading - The heading as written
 * @returns The kind, `other` for a heading the page has no special treatment for
 */
export function sectionKind(heading: string): ChangelogSectionKind {
  return SECTION_KINDS[heading.trim().toLowerCase()] ?? 'other'
}

/** What a release heading names. */
interface ReleaseHeading {
  /** The version */
  version: string
  /** The compare link the version was wrapped in, when it was */
  compareUrl: string | null
  /** The release day, when the heading carries one */
  date: string | null
}

/**
 * Read a release heading into its parts.
 *
 * Written as a walk over the line rather than as one pattern: the heading
 * has an optional link around the version and an optional date after it,
 * and a single expression for both is the kind that backtracks.
 *
 * @param line - A line starting with `## `
 * @returns The heading's parts, or null when the line is not a release heading
 */
function parseReleaseHeading(line: string): ReleaseHeading | null {
  if (!line.startsWith(RELEASE_PREFIX)) return null
  let rest = line.slice(RELEASE_PREFIX.length).trim()
  let date: string | null = null
  const separator = rest.lastIndexOf(DATE_SEPARATOR)
  if (separator !== -1) {
    const candidate = rest.slice(separator + DATE_SEPARATOR.length).trim()
    if (DAY_PATTERN.test(candidate)) {
      date = candidate
      rest = rest.slice(0, separator).trim()
    }
  }
  if (rest === '' || rest.includes(' ')) return null
  if (rest.startsWith('[')) {
    const close = rest.indexOf('](')
    if (close === -1 || !rest.endsWith(')')) return null
    return { version: rest.slice(1, close), compareUrl: rest.slice(close + 2, -1), date }
  }
  return { version: rest, compareUrl: null, date }
}

/**
 * Read one note line into its parts.
 *
 * @param line - The text after the list marker
 * @returns The note
 */
function parseItem(line: string): ChangelogItem {
  let text = line.trim()
  const breaking = text.startsWith(BREAKING_MARKER)
  if (breaking) text = text.slice(BREAKING_MARKER.length)
  const scoped = SCOPE_PREFIX.exec(text)
  const scope = scoped === null ? null : scoped[1]
  if (scoped !== null) text = text.slice(scoped[0].length)
  return { text, scope, breaking }
}

/**
 * Parse a package's `CHANGELOG.md` into its releases.
 *
 * The file is the one `@hyperfrontend/versioning` writes: a title, a
 * sentence, then one `##` heading per release carrying the version, an
 * optional compare link and a date, with `###` sections of `-` notes under
 * each. Nothing above the first release heading is kept, because it is the
 * same sentence in every file. A note's `**BREAKING**` marker and its
 * `**scope:**` prefix are lifted out into fields, so a page can style them
 * rather than render bold text and hope.
 *
 * Releases come back in file order, which is newest first.
 *
 * @param markdown - The file contents
 * @returns The releases, newest first
 *
 * @example Reading a release heading with a compare link
 * ```typescript
 * parseChangelog('# Changelog\n\n## [1.0.0](https://example.com/compare/a...b) - 2026-09-08\n\n### Features\n\n- ship it\n')
 * // [{ version: '1.0.0', date: '2026-09-08', compareUrl: 'https://example.com/compare/a...b', sections: [{ heading: 'Features', kind: 'features', items: [{ text: 'ship it', scope: null, breaking: false }] }] }]
 * ```
 */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let release: ChangelogRelease | null = null
  let section: ChangelogSection | null = null

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd()
    const heading = parseReleaseHeading(line)
    if (heading !== null) {
      release = { version: heading.version, date: heading.date, compareUrl: heading.compareUrl, sections: [] }
      section = null
      releases.push(release)
      continue
    }
    if (release === null) continue

    const sectionHeading = SECTION_HEADING.exec(line)
    if (sectionHeading !== null) {
      section = { heading: sectionHeading[1], kind: sectionKind(sectionHeading[1]), items: [] }
      release.sections.push(section)
      continue
    }

    const item = ITEM_LINE.exec(line)
    if (item !== null) {
      // why: a note before any section heading is still a note; it is filed under a heading the page will not name
      if (section === null) {
        section = { heading: '', kind: 'other', items: [] }
        release.sections.push(section)
      }
      section.items.push(parseItem(item[1]))
    }
  }

  return releases
}
