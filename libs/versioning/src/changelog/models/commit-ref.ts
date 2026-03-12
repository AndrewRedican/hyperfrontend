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
 */
export function getShortHash(hash: string): string {
  return hash.slice(0, 7)
}
