import type { Changelog, ChangelogFormat, ChangelogHeader, ChangelogLink, ChangelogMetadata } from '../models/changelog'
import type { ChangelogEntry, ChangelogItem, ChangelogSection } from '../models/entry'
import type { Token } from './tokenizer'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { createChangelogItem } from '../models/entry'
import { getSectionType } from '../models/section'
import { parseBreakingFromItem } from './breaking'
import { parseVersionFromHeading, parseScopeFromItem, parseCommitRefs, parseIssueRefs } from './line'
import { tokenize } from './tokenizer'

/**
 * Validates that a URL is actually a GitHub URL by parsing it properly.
 * This prevents SSRF attacks where 'github.com' could appear in path/query.
 *
 * @param url - The URL string to validate
 * @returns True if the URL host is github.com or a subdomain
 */
function isGitHubUrl(url: string): boolean {
  try {
    const parsed = createURL(url)
    return parsed.host === 'github.com' || parsed.host.endsWith('.github.com')
  } catch {
    return false
  }
}

/**
 * Internal state used during changelog parsing to track position and collect metadata.
 */
interface ParserState {
  /** Tokenized changelog content */
  tokens: Token[]
  /** Current position in the token stream */
  pos: number
  /** Parsing warnings encountered */
  warnings: string[]
  /** Repository URL if detected */
  repositoryUrl?: string
}

/**
 * Parses a changelog markdown string into a Changelog object.
 *
 * @param content - The markdown content to parse
 * @param source - Optional source file path
 * @returns Parsed Changelog object
 *
 * @example Parsing a changelog markdown string
 * ```typescript
 * const markdown = `# Changelog
 *
 * ## [1.0.0] - 2024-01-15
 *
 * ### Added
 * - Initial release`
 *
 * const changelog = parseChangelog(markdown, 'CHANGELOG.md')
 * // => { header: { title: '# Changelog', ... }, entries: [{ version: '1.0.0', ... }] }
 * ```
 */
export function parseChangelog(content: string, source?: string): Changelog {
  const tokens = tokenize(content)
  const state: ParserState = {
    tokens,
    pos: 0,
    warnings: [],
  }

  const header = parseHeader(state)

  const entries = parseEntries(state)

  const format = detectFormat(header, entries)

  const metadata: ChangelogMetadata = {
    format,
    isConventional: format === 'conventional',
    repositoryUrl: state.repositoryUrl,
    warnings: state.warnings,
  }

  return {
    source,
    header,
    entries,
    metadata,
  }
}

/**
 * Parses the changelog header section.
 *
 * @param state - The parser state containing tokens and position
 * @returns The parsed ChangelogHeader with title, description, and links
 */
function parseHeader(state: ParserState): ChangelogHeader {
  let title = '# Changelog'
  const description: string[] = []
  const links: ChangelogLink[] = []

  const headingToken = currentToken(state)
  if (headingToken?.type === 'heading-1') {
    title = `# ${headingToken.value}`
    advance(state)
  }

  skipNewlines(state)

  while (!isEOF(state) && currentToken(state)?.type !== 'heading-2') {
    const token = currentToken(state)
    if (!token) break

    if (token.type === 'text') {
      description.push(token.value)
    } else if (token.type === 'link-text') {
      const nextToken = peek(state, 1)
      if (nextToken?.type === 'link-url') {
        description.push(`[${token.value}](${nextToken.value})`)
        links.push({ label: token.value, url: nextToken.value })

        if (!state.repositoryUrl && isGitHubUrl(nextToken.value)) {
          state.repositoryUrl = extractRepoUrl(nextToken.value)
        }

        advance(state)
        advance(state)
        continue
      }
    } else if (token.type === 'newline' || token.type === 'blank-line') {
      if (description.length > 0 && description[description.length - 1] !== '') {
        description.push('')
      }
    }

    advance(state)
  }

  while (description.length > 0 && description[description.length - 1] === '') {
    description.pop()
  }

  return { title, description, links }
}

/**
 * Parses all changelog entries.
 *
 * @param state - The parser state containing tokens and position
 * @returns An array of parsed ChangelogEntry objects
 */
function parseEntries(state: ParserState): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []

  while (!isEOF(state)) {
    if (currentToken(state)?.type === 'heading-2') {
      const entry = parseEntry(state)
      if (entry) {
        entries.push(entry)
      }
    } else {
      advance(state)
    }
  }

  return entries
}

/**
 * Parses a single changelog entry.
 *
 * @param state - The parser state containing tokens and position
 * @returns The parsed ChangelogEntry or null if parsing fails
 */
function parseEntry(state: ParserState): ChangelogEntry | null {
  const headingToken = currentToken(state)
  if (headingToken?.type !== 'heading-2') {
    return null
  }

  const { version, date, compareUrl } = parseVersionFromHeading(headingToken.value)
  const unreleased = version.toLowerCase() === 'unreleased'

  advance(state)
  skipNewlines(state)

  const sections = parseSections(state)

  return {
    version,
    date,
    unreleased,
    compareUrl,
    sections,
  }
}

/**
 * Parses sections within an entry.
 *
 * @param state - The parser state containing tokens and position
 * @returns An array of parsed ChangelogSection objects
 */
function parseSections(state: ParserState): ChangelogSection[] {
  const sections: ChangelogSection[] = []

  while (!isEOF(state)) {
    const token = currentToken(state)

    if (token?.type === 'heading-2') {
      break
    }

    if (token?.type === 'heading-3') {
      const section = parseSection(state)
      if (section) {
        sections.push(section)
      }
    } else if (token?.type === 'list-item') {
      const items = parseItems(state)
      if (items.length > 0) {
        sections.push({
          type: 'other',
          heading: 'Changes',
          items,
        })
      }
    } else {
      advance(state)
    }
  }

  return sections
}

/**
 * Parses a single section.
 *
 * @param state - The parser state containing tokens and position
 * @returns The parsed ChangelogSection or null if parsing fails
 */
function parseSection(state: ParserState): ChangelogSection | null {
  const headingToken = currentToken(state)
  if (headingToken?.type !== 'heading-3') {
    return null
  }

  const heading = headingToken.value
  const type = getSectionType(heading)

  advance(state)
  skipNewlines(state)

  const items = parseItems(state)

  return {
    type,
    heading,
    items,
  }
}

/**
 * Parses list items.
 *
 * @param state - The parser state containing tokens and position
 * @returns An array of parsed ChangelogItem objects
 */
function parseItems(state: ParserState): ChangelogItem[] {
  const items: ChangelogItem[] = []

  while (!isEOF(state)) {
    const token = currentToken(state)

    if (token?.type === 'heading-2' || token?.type === 'heading-3') {
      break
    }

    if (token?.type === 'list-item') {
      const item = parseItem(state)
      if (item) {
        items.push(item)
      }
    } else {
      advance(state)
    }
  }

  return items
}

/**
 * Parses a single list item.
 *
 * @param state - The parser state containing tokens and position
 * @returns The parsed ChangelogItem or null if parsing fails
 */
function parseItem(state: ParserState): ChangelogItem | null {
  const token = currentToken(state)
  if (token?.type !== 'list-item') {
    return null
  }

  const text = token.value
  const marker = parseBreakingFromItem(text)
  const { scope, description } = parseScopeFromItem(marker.text)
  const commits = parseCommitRefs(text, state.repositoryUrl)
  const references = parseIssueRefs(text, state.repositoryUrl)

  const breaking = marker.breaking || isBreakingItem(marker.text)

  advance(state)

  return createChangelogItem(description, {
    scope,
    commits,
    references,
    breaking,
  })
}

/**
 * Checks if an item indicates a breaking change. Runs on the text left after
 * {@link parseBreakingFromItem} has removed the leading markers, so the
 * serializer's own marker cannot feed back into the next parse.
 *
 * @param text - The text content of the item
 * @returns True if the item indicates a breaking change
 */
function isBreakingItem(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('breaking change') || lower.includes('breaking:') || lower.startsWith('!') || lower.includes('[breaking]')
}

/**
 * Detects the changelog format.
 *
 * @param header - The parsed header of the changelog
 * @param entries - The parsed changelog entries
 * @returns The detected ChangelogFormat
 */
function detectFormat(header: ChangelogHeader, entries: ChangelogEntry[]): ChangelogFormat {
  const descriptionText = header.description.join(' ').toLowerCase()

  if (descriptionText.includes('keep a changelog') || descriptionText.includes('keepachangelog')) {
    return 'keep-a-changelog'
  }

  const hasConventionalSections = entries.some((entry) =>
    entry.sections.some((section) => ['features', 'fixes', 'performance'].includes(section.type))
  )

  if (hasConventionalSections) {
    return 'conventional'
  }

  if (entries.some((entry) => entry.sections.length > 0)) {
    return 'custom'
  }

  return 'unknown'
}

/**
 * Extracts repository URL from a GitHub URL.
 *
 * @param url - The URL to extract the repository from
 * @returns The repository URL or undefined if not found
 */
function extractRepoUrl(url: string): string | undefined {
  const githubIndex = url.indexOf('github.com/')
  if (githubIndex !== -1) {
    const afterGithub = url.slice(githubIndex + 11)
    const parts = afterGithub.split('/')
    if (parts.length >= 2) {
      return `https://github.com/${parts[0]}/${parts[1]}`
    }
  }
  return undefined
}

/**
 * Gets the current token at the parser position.
 *
 * @param state - The parser state
 * @returns The current token or undefined if at end
 */
function currentToken(state: ParserState): Token | undefined {
  return state.tokens[state.pos]
}

/**
 * Peeks at a token at an offset from the current position.
 *
 * @param state - The parser state
 * @param offset - The offset from current position
 * @returns The token at the offset or undefined if out of bounds
 */
function peek(state: ParserState, offset: number): Token | undefined {
  return state.tokens[state.pos + offset]
}

/**
 * Advances the parser position by one token.
 *
 * @param state - The parser state to advance
 */
function advance(state: ParserState): void {
  state.pos++
}

/**
 * Checks if the parser has reached the end of the token stream.
 *
 * @param state - The parser state
 * @returns True if at end of file
 */
function isEOF(state: ParserState): boolean {
  const token = currentToken(state)
  return !token || token.type === 'eof'
}

/**
 * Skips newline tokens until a non-newline token is found.
 *
 * @param state - The parser state
 */
function skipNewlines(state: ParserState): void {
  while (!isEOF(state)) {
    const token = currentToken(state)
    if (token?.type !== 'newline' && token?.type !== 'blank-line') {
      break
    }
    advance(state)
  }
}
