/**
 * Type of git reference.
 */
export type GitRefType = 'branch' | 'tag' | 'remote' | 'head' | 'stash'

/**
 * A git reference.
 */
export interface GitRef {
  /** Full reference name (e.g., refs/heads/main) */
  readonly fullName: string

  /** Short reference name (e.g., main) */
  readonly name: string

  /** Reference type */
  readonly type: GitRefType

  /** Target commit hash */
  readonly commitHash: string

  /** Remote name for remote refs */
  readonly remote?: string

  /** Whether this is the current HEAD */
  readonly isHead?: boolean
}

/**
 * Options for creating a git reference.
 */
export interface CreateGitRefOptions {
  /** Full reference name */
  readonly fullName: string

  /** Target commit hash */
  readonly commitHash: string

  /** Whether this is the current HEAD */
  readonly isHead?: boolean
}

/**
 * Creates a git reference from full name.
 * Parses the reference type from the full name.
 *
 * @param options - Reference creation options
 * @returns A new GitRef object
 *
 * @example Create a git reference from full name
 * const ref = createGitRef({
 *   fullName: 'refs/heads/main',
 *   commitHash: 'abc123...',
 * })
 */
export function createGitRef(options: CreateGitRefOptions): GitRef {
  const { type, name, remote } = parseRefName(options.fullName)

  return {
    fullName: options.fullName,
    name,
    type,
    commitHash: options.commitHash,
    remote,
    isHead: options.isHead,
  }
}

/**
 * Parsed reference name components.
 */
interface ParsedRefName {
  /** Type of the Git reference (branch, tag, etc.) */
  type: GitRefType
  /** Name of the reference */
  name: string
  /** Remote name if this is a remote tracking branch */
  remote?: string
}

/**
 * Parses a full reference name into its components.
 * Uses character-by-character parsing (no regex).
 *
 * @param fullName - Full reference name
 * @returns Parsed components
 *
 * @example
 * parseRefName('refs/heads/main') // { type: 'branch', name: 'main' }
 * parseRefName('refs/remotes/origin/main') // { type: 'remote', name: 'main', remote: 'origin' }
 */
function parseRefName(fullName: string): ParsedRefName {
  if (fullName === 'HEAD') {
    return { type: 'head', name: 'HEAD' }
  }

  const parts = splitByChar(fullName, '/')

  if (parts.length >= 3 && parts[0] === 'refs' && parts[1] === 'heads') {
    return {
      type: 'branch',
      name: parts.slice(2).join('/'),
    }
  }

  if (parts.length >= 3 && parts[0] === 'refs' && parts[1] === 'tags') {
    return {
      type: 'tag',
      name: parts.slice(2).join('/'),
    }
  }

  if (parts.length >= 4 && parts[0] === 'refs' && parts[1] === 'remotes') {
    return {
      type: 'remote',
      name: parts.slice(3).join('/'),
      remote: parts[2],
    }
  }

  if (parts.length >= 2 && parts[0] === 'refs' && parts[1] === 'stash') {
    return {
      type: 'stash',
      name: parts.slice(1).join('/'),
    }
  }

  return {
    type: 'branch',
    name: fullName,
  }
}

/**
 * Splits a string by a character.
 * Character-by-character implementation (no regex).
 *
 * @param str - String to split
 * @param char - Character to split by
 * @returns Array of parts
 */
function splitByChar(str: string, char: string): string[] {
  const parts: string[] = []
  let current = ''

  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) {
      parts.push(current)
      current = ''
    } else {
      current += str[i]
    }
  }

  parts.push(current)
  return parts
}

/**
 * Checks if a reference is a branch.
 *
 * @param ref - Reference to check
 * @returns True if reference is a branch
 *
 * @example Check if reference is a branch
 * ```typescript
 * isBranchRef({ type: 'branch', name: 'main' }) // => true
 * ```
 */
export function isBranchRef(ref: GitRef): boolean {
  return ref.type === 'branch'
}

/**
 * Checks if a reference is a tag.
 *
 * @param ref - Reference to check
 * @returns True if reference is a tag
 *
 * @example Check if reference is a tag
 * ```typescript
 * isTagRef({ type: 'tag', name: 'v1.0.0' }) // => true
 * ```
 */
export function isTagRef(ref: GitRef): boolean {
  return ref.type === 'tag'
}

/**
 * Checks if a reference is a remote tracking branch.
 *
 * @param ref - Reference to check
 * @returns True if reference is a remote
 *
 * @example Check if reference is a remote tracking branch
 * ```typescript
 * isRemoteRef({ type: 'remote', name: 'main', remote: 'origin' }) // => true
 * ```
 */
export function isRemoteRef(ref: GitRef): boolean {
  return ref.type === 'remote'
}

/**
 * Checks if a reference points to the current HEAD.
 *
 * @param ref - Reference to check
 * @returns True if reference is HEAD
 *
 * @example Check if reference points to HEAD
 * ```typescript
 * isHeadRef({ type: 'head', name: 'HEAD' }) // => true
 * isHeadRef({ type: 'branch', name: 'main', isHead: true }) // => true
 * ```
 */
export function isHeadRef(ref: GitRef): boolean {
  return ref.type === 'head' || ref.isHead === true
}

/**
 * Gets the tracking remote for a reference.
 *
 * @param ref - Reference to check
 * @returns Remote name or undefined
 *
 * @example Get the remote for a reference
 * ```typescript
 * getRemote({ type: 'remote', name: 'main', remote: 'origin' }) // => 'origin'
 * getRemote({ type: 'branch', name: 'main' }) // => undefined
 * ```
 */
export function getRemote(ref: GitRef): string | undefined {
  return ref.remote
}

/**
 * Builds a full reference name from type and name.
 *
 * @param type - Reference type
 * @param name - Reference name
 * @param remote - Remote name (for remote type)
 * @returns Full reference name
 *
 * @example Build full reference names from type and name
 * buildRefName('branch', 'main') // 'refs/heads/main'
 * buildRefName('tag', 'v1.0.0') // 'refs/tags/v1.0.0'
 * buildRefName('remote', 'main', 'origin') // 'refs/remotes/origin/main'
 */
export function buildRefName(type: GitRefType, name: string, remote?: string): string {
  switch (type) {
    case 'branch':
      return `refs/heads/${name}`
    case 'tag':
      return `refs/tags/${name}`
    case 'remote':
      return remote ? `refs/remotes/${remote}/${name}` : `refs/remotes/${name}`
    case 'head':
      return 'HEAD'
    case 'stash':
      return `refs/stash`
    default:
      return name
  }
}

/**
 * Compares two references by name (alphabetically).
 *
 * @param a - First reference
 * @param b - Second reference
 * @returns Comparison result (-1, 0, or 1)
 *
 * @example Sort references alphabetically by name
 * ```typescript
 * const refs = [refB, refA, refC]
 * refs.sort(compareRefsByName) // => [refA, refB, refC]
 * ```
 */
export function compareRefsByName(a: GitRef, b: GitRef): number {
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}

/**
 * Filters references by type.
 *
 * @param refs - References to filter
 * @param type - Type to filter by
 * @returns Filtered references
 *
 * @example Filter references by type
 * ```typescript
 * const branches = filterRefsByType(allRefs, 'branch')
 * const tags = filterRefsByType(allRefs, 'tag')
 * ```
 */
export function filterRefsByType(refs: readonly GitRef[], type: GitRefType): readonly GitRef[] {
  const result: GitRef[] = []
  for (const ref of refs) {
    if (ref.type === type) {
      result.push(ref)
    }
  }
  return result
}

/**
 * Filters references by remote.
 *
 * @param refs - References to filter
 * @param remote - Remote name to filter by
 * @returns Filtered references
 *
 * @example Filter references by remote
 * ```typescript
 * const originRefs = filterRefsByRemote(remoteRefs, 'origin')
 * const upstreamRefs = filterRefsByRemote(remoteRefs, 'upstream')
 * ```
 */
export function filterRefsByRemote(refs: readonly GitRef[], remote: string): readonly GitRef[] {
  const result: GitRef[] = []
  for (const ref of refs) {
    if (ref.remote === remote) {
      result.push(ref)
    }
  }
  return result
}
