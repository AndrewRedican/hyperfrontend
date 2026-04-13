/**
 * Commit Reference
 *
 * Represents a reference to a git commit in a changelog item.
 */
export interface CommitRef {
  /** Full commit hash */
  readonly hash: string

  /** Short commit hash (typically 7 characters) */
  readonly shortHash: string

  /** URL to the commit (e.g., GitHub commit link) */
  readonly url?: string
}

/**
 * Issue/PR Reference
 *
 * Represents a reference to an issue or pull request.
 */
export interface IssueRef {
  /** Issue or PR number */
  readonly number: number

  /** URL to the issue/PR */
  readonly url?: string

  /** Type of reference */
  readonly type: 'issue' | 'pull-request'
}

/**
 * Creates a commit reference from a full hash.
 *
 * @param hash - The full commit hash
 * @param url - Optional URL to the commit
 * @returns A new CommitRef object with both full and short hash
 *
 * @example Creating a commit reference
 * ```typescript
 * const ref = createCommitRef('abc1234def5678', 'https://github.com/org/repo/commit/abc1234def5678')
 * // => { hash: 'abc1234def5678', shortHash: 'abc1234', url: 'https://...' }
 * ```
 */
export function createCommitRef(hash: string, url?: string): CommitRef {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    url,
  }
}

/**
 * Creates an issue reference.
 *
 * @param number - The issue or PR number
 * @param type - The type of reference ('issue' or 'pull-request')
 * @param url - Optional URL to the issue or PR
 * @returns A new IssueRef object
 *
 * @example Creating issue and PR references
 * ```typescript
 * const issueRef = createIssueRef(42, 'issue', 'https://github.com/org/repo/issues/42')
 * // => { number: 42, type: 'issue', url: 'https://...' }
 *
 * const prRef = createIssueRef(123, 'pull-request')
 * // => { number: 123, type: 'pull-request', url: undefined }
 * ```
 */
export function createIssueRef(number: number, type: 'issue' | 'pull-request' = 'issue', url?: string): IssueRef {
  return {
    number,
    type,
    url,
  }
}

/**
 * Extracts the short hash from a full commit hash.
 *
 * @param hash - The full commit hash
 * @returns The first 7 characters of the hash
 *
 * @example Extracting short hash from full hash
 * ```typescript
 * getShortHash('abc1234def5678901234567890')
 * // => 'abc1234'
 * ```
 */
export function getShortHash(hash: string): string {
  return hash.slice(0, 7)
}
