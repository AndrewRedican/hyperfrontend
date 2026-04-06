import type { CommitType } from './commit-type'

/** Footer trailer in a conventional commit message */
export interface CommitFooter {
  /** Footer key (e.g., "BREAKING CHANGE", "Refs", "Fixes") */
  readonly key: string

  /** Footer value */
  readonly value: string

  /** Whether key used `:` or ` #` separator */
  readonly separator: ':' | ' #'
}

/** Parsed conventional commit message per https://www.conventionalcommits.org/en/v1.0.0/ */
export interface ConventionalCommit {
  /** Commit type (feat, fix, docs, etc.) */
  readonly type: CommitType

  /** Optional scope in parentheses */
  readonly scope?: string

  /** Subject line (after colon) */
  readonly subject: string

  /** Full commit body */
  readonly body?: string

  /** Parsed footer trailers */
  readonly footers: readonly CommitFooter[]

  /** Whether this is a breaking change */
  readonly breaking: boolean

  /** Breaking change description (from footer or subject !) */
  readonly breakingDescription?: string

  /** Original raw message */
  readonly raw: string
}

/**
 * Creates a commit footer.
 *
 * @param key - Footer identifier such as 'Refs', 'Fixes', or 'BREAKING CHANGE'
 * @param value - Associated content for the footer entry
 * @param separator - Delimiter between key and value (':' or ' #')
 * @returns A new CommitFooter object
 */
export function createCommitFooter(key: string, value: string, separator: ':' | ' #' = ':'): CommitFooter {
  return {
    key,
    value,
    separator,
  }
}

/**
 * Creates a conventional commit.
 *
 * @param type - The commit type (e.g., 'feat', 'fix')
 * @param subject - The commit subject line
 * @param options - Optional configuration for scope, body, footers, etc.
 * @returns A new ConventionalCommit object
 */
export function createConventionalCommit(
  type: CommitType,
  subject: string,
  options?: Partial<Omit<ConventionalCommit, 'type' | 'subject' | 'raw'>> & {
    /** Raw commit message string override */
    raw?: string
  }
): ConventionalCommit {
  const raw = options?.raw ?? buildRaw(type, subject, options)

  return {
    type,
    subject,
    scope: options?.scope,
    body: options?.body,
    footers: options?.footers ?? [],
    breaking: options?.breaking ?? false,
    breakingDescription: options?.breakingDescription,
    raw,
  }
}

/**
 * Builds the raw commit message from parts.
 *
 * @param type - The commit type
 * @param subject - The commit subject
 * @param options - Optional configuration for building the message
 * @returns The formatted raw commit message string
 */
function buildRaw(type: CommitType, subject: string, options?: Partial<Omit<ConventionalCommit, 'type' | 'subject' | 'raw'>>): string {
  let header = type

  if (options?.scope) {
    header += `(${options.scope})`
  }

  if (options?.breaking) {
    header += '!'
  }

  header += `: ${subject}`

  const parts = [header]

  if (options?.body) {
    parts.push('')
    parts.push(options.body)
  }

  if (options?.footers?.length) {
    parts.push('')
    for (const footer of options.footers) {
      parts.push(`${footer.key}${footer.separator}${footer.separator === ':' ? ' ' : ''}${footer.value}`)
    }
  }

  return parts.join('\n')
}
