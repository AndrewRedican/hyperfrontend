/**
 * A git commit with its metadata.
 */
export interface GitCommit {
  /** Full commit hash (40 characters) */
  readonly hash: string

  /** Abbreviated commit hash (typically 7 characters) */
  readonly shortHash: string

  /** Commit author name */
  readonly authorName: string

  /** Commit author email */
  readonly authorEmail: string

  /** Author date (ISO 8601 format) */
  readonly authorDate: string

  /** Committer name */
  readonly committerName: string

  /** Committer email */
  readonly committerEmail: string

  /** Commit date (ISO 8601 format) */
  readonly commitDate: string

  /** Commit subject (first line of message) */
  readonly subject: string

  /** Full commit body (excludes subject) */
  readonly body: string

  /** Full commit message (subject + body) */
  readonly message: string

  /** Parent commit hashes */
  readonly parents: readonly string[]

  /** Associated refs (branches, tags, etc.) */
  readonly refs: readonly string[]
}

/**
 * Options for creating a git commit model.
 */
export interface CreateGitCommitOptions {
  /** Full commit hash */
  readonly hash: string

  /** Commit author name */
  readonly authorName: string

  /** Commit author email */
  readonly authorEmail: string

  /** Author date (ISO 8601 format) */
  readonly authorDate: string

  /** Commit subject (first line of message) */
  readonly subject: string

  /** Committer name (defaults to author) */
  readonly committerName?: string

  /** Committer email (defaults to author) */
  readonly committerEmail?: string

  /** Commit date (defaults to author date) */
  readonly commitDate?: string

  /** Full commit body (defaults to empty string) */
  readonly body?: string

  /** Parent commit hashes (defaults to empty array) */
  readonly parents?: readonly string[]

  /** Associated refs (defaults to empty array) */
  readonly refs?: readonly string[]
}

/**
 * Creates a git commit model.
 *
 * @param options - Commit creation options
 * @returns A new GitCommit object
 *
 * @example
 * const commit = createGitCommit({
 *   hash: 'abc123...',
 *   authorName: 'John Doe',
 *   authorEmail: 'john@example.com',
 *   authorDate: '2026-03-12T10:00:00Z',
 *   subject: 'feat: add new feature',
 * })
 */
export function createGitCommit(options: CreateGitCommitOptions): GitCommit {
  const body = options.body ?? ''
  const subject = options.subject

  return {
    hash: options.hash,
    shortHash: getShortHash(options.hash),
    authorName: options.authorName,
    authorEmail: options.authorEmail,
    authorDate: options.authorDate,
    committerName: options.committerName ?? options.authorName,
    committerEmail: options.committerEmail ?? options.authorEmail,
    commitDate: options.commitDate ?? options.authorDate,
    subject,
    body,
    message: body ? `${subject}\n\n${body}` : subject,
    parents: options.parents ?? [],
    refs: options.refs ?? [],
  }
}

/**
 * Gets a short hash (7 characters) from a full commit hash.
 *
 * @param hash - Full commit hash
 * @returns Short hash (7 characters)
 *
 * @example
 * ```typescript
 * getShortHash('abc123def456789') // => 'abc123d'
 * ```
 */
export function getShortHash(hash: string): string {
  return hash.slice(0, 7)
}

/**
 * Checks if two commits are the same based on their hash.
 *
 * @param a - First commit
 * @param b - Second commit
 * @returns True if commits have the same hash
 *
 * @example
 * ```typescript
 * isSameCommit(commitA, commitB) // => true if commitA.hash === commitB.hash
 * ```
 */
export function isSameCommit(a: GitCommit, b: GitCommit): boolean {
  return a.hash === b.hash
}

/**
 * Checks if a commit is a merge commit (has multiple parents).
 *
 * @param commit - Commit to check
 * @returns True if commit has more than one parent
 *
 * @example
 * ```typescript
 * if (isMergeCommit(commit)) {
 *   console.log('Commit has parents:', commit.parents)
 * }
 * ```
 */
export function isMergeCommit(commit: GitCommit): boolean {
  return commit.parents.length > 1
}

/**
 * Checks if a commit is a root commit (has no parents).
 *
 * @param commit - Commit to check
 * @returns True if commit has no parents
 *
 * @example
 * ```typescript
 * if (isRootCommit(commit)) {
 *   console.log('This is the initial commit')
 * }
 * ```
 */
export function isRootCommit(commit: GitCommit): boolean {
  return commit.parents.length === 0
}

/**
 * Extracts the scope from a commit subject if it follows conventional commit format.
 * Uses character-by-character parsing (no regex).
 *
 * @param subject - Commit subject line
 * @returns Scope string or undefined if no scope found
 *
 * @example
 * extractScope('feat(lib-versioning): add git support') // 'lib-versioning'
 * extractScope('fix: resolve issue') // undefined
 */
export function extractScope(subject: string): string | undefined {
  let i = 0

  while (i < subject.length) {
    const code = subject.charCodeAt(i)
    if (code >= 97 && code <= 122) {
      i++
    } else {
      break
    }
  }

  if (i >= subject.length || subject[i] !== '(') {
    return undefined
  }

  i++
  const scopeStart = i

  while (i < subject.length && subject[i] !== ')') {
    i++
  }

  if (i >= subject.length) {
    return undefined
  }

  const scope = subject.slice(scopeStart, i)
  return scope || undefined
}

/**
 * Extracts the type from a commit subject if it follows conventional commit format.
 * Uses character-by-character parsing (no regex).
 *
 * @param subject - Commit subject line
 * @returns Type string or undefined if no valid type found
 *
 * @example
 * extractType('feat(lib-versioning): add git support') // 'feat'
 * extractType('fix: resolve issue') // 'fix'
 * extractType('random message') // undefined
 */
export function extractType(subject: string): string | undefined {
  let i = 0

  while (i < subject.length) {
    const code = subject.charCodeAt(i)
    if (code >= 97 && code <= 122) {
      i++
    } else {
      break
    }
  }

  if (i === 0) {
    return undefined
  }

  const type = subject.slice(0, i)

  if (i >= subject.length) {
    return undefined
  }

  const next = subject[i]
  if (next === '(' || next === ':' || next === '!') {
    return type
  }

  return undefined
}
