import type { GitRef } from './models/ref'
import { execFileSync } from 'node:child_process'
import { createGitRef } from './models/ref'

/**
 * Validates a remote name to prevent command injection attacks.
 *
 * Git commands like fetch, pull, and push can execute arbitrary commands
 * if a malicious remote name starting with '--' is passed (e.g., '--upload-pack=cmd').
 *
 * Allowed characters: a-z, A-Z, 0-9, underscore, hyphen (not first), dot
 *
 * @param remote - The remote name to validate
 * @returns True if the remote name is safe
 * @see https://cwe.mitre.org/data/definitions/88.html (Argument Injection)
 *
 * @example Rejecting an argument-injection attempt
 * ```typescript
 * isValidRemoteName('origin') // true
 * isValidRemoteName('--upload-pack=rm -rf /') // false
 * ```
 */
export function isValidRemoteName(remote: string): boolean {
  if (!remote || typeof remote !== 'string') {
    return false
  }

  for (let i = 0; i < remote.length; i++) {
    const code = remote.charCodeAt(i)

    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95) {
      continue
    }

    if (i > 0 && (code === 45 || code === 46)) {
      continue
    }

    return false
  }

  return true
}

/**
 * Options for git fetch operations.
 */
export interface GitFetchOptions {
  /** Whether to prune deleted remote branches */
  prune?: boolean
  /** Whether to fetch tags */
  tags?: boolean
}

/**
 * Options for git push operations.
 */
export interface GitPushOptions {
  /** Whether to force push */
  force?: boolean
  /** Whether to set upstream tracking */
  setUpstream?: boolean
}

/**
 * Options for git command execution, shared by the remote helpers and the git client factory.
 */
export interface GitCommandOptions {
  /** Working directory for the git command */
  cwd: string
  /** Command timeout in milliseconds */
  timeout: number
}

/**
 * Gets all refs from the repository.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @returns Array of GitRef objects representing all refs in the repository
 *
 * @example Listing every ref in a repository
 * ```typescript
 * const refs = getRefs({ cwd: '/path/to/repo', timeout: 30000 })
 * ```
 */
export function getRefs(options: GitCommandOptions): readonly GitRef[] {
  try {
    const output = execFileSync('git', ['show-ref'], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const refs: GitRef[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const spaceIndex = trimmed.indexOf(' ')
      if (spaceIndex === -1) continue

      const hash = trimmed.slice(0, spaceIndex)
      const fullName = trimmed.slice(spaceIndex + 1)

      refs.push(createGitRef({ fullName, commitHash: hash }))
    }

    return refs
  } catch {
    return []
  }
}

/**
 * Gets local branches.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @returns Array of GitRef objects representing local branches
 *
 * @example Listing local branch names
 * ```typescript
 * const names = getBranches({ cwd: '/path/to/repo', timeout: 30000 }).map((ref) => ref.name)
 * ```
 */
export function getBranches(options: GitCommandOptions): readonly GitRef[] {
  const refs = getRefs(options)
  return refs.filter((ref) => ref.type === 'branch')
}

/**
 * Gets remote branches.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @param remote - Optional remote name to filter branches by
 * @returns Array of GitRef objects representing remote branches
 *
 * @example Listing branches tracked on origin
 * ```typescript
 * const branches = getRemoteBranches({ cwd: '/path/to/repo', timeout: 30000 }, 'origin')
 * ```
 */
export function getRemoteBranches(options: GitCommandOptions, remote?: string): readonly GitRef[] {
  const refs = getRefs(options)
  return refs.filter((ref) => {
    if (ref.type !== 'remote') return false
    if (remote && ref.remote !== remote) return false
    return true
  })
}

/**
 * Fetches from remote.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @param remote - Remote name to fetch from (defaults to 'origin')
 * @param fetchOptions - Additional fetch configuration
 * @param fetchOptions.prune - Whether to prune deleted remote branches
 * @param fetchOptions.tags - Whether to fetch tags
 * @returns True if fetch succeeded
 *
 * @example Fetching tags while pruning deleted branches
 * ```typescript
 * const ok = fetch({ cwd: '/path/to/repo', timeout: 30000 }, 'origin', { prune: true, tags: true })
 * ```
 */
export function fetch(options: GitCommandOptions, remote = 'origin', fetchOptions?: GitFetchOptions): boolean {
  if (!isValidRemoteName(remote)) {
    return false
  }
  const args: string[] = ['fetch', '--', remote]

  if (fetchOptions?.prune) {
    args.push('--prune')
  }
  if (fetchOptions?.tags) {
    args.push('--tags')
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout * 3,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Pulls from remote.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @param remote - Remote name to pull from (defaults to 'origin')
 * @param branch - Optional branch name to pull
 * @returns True if pull succeeded
 *
 * @example Pulling a specific branch from origin
 * ```typescript
 * const ok = pull({ cwd: '/path/to/repo', timeout: 30000 }, 'origin', 'main')
 * ```
 */
export function pull(options: GitCommandOptions, remote = 'origin', branch?: string): boolean {
  if (!isValidRemoteName(remote)) {
    return false
  }
  const args: string[] = ['pull', '--', remote]
  if (branch) {
    args.push(branch)
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout * 3,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Pushes to remote.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @param remote - Remote name to push to (defaults to 'origin')
 * @param branch - Optional branch name to push
 * @param pushOptions - Additional push configuration
 * @param pushOptions.force - Whether to force push
 * @param pushOptions.setUpstream - Whether to set upstream tracking
 * @returns True if push succeeded
 *
 * @example Pushing a new branch and setting upstream tracking
 * ```typescript
 * const ok = push({ cwd: '/path/to/repo', timeout: 30000 }, 'origin', 'feature', { setUpstream: true })
 * ```
 */
export function push(options: GitCommandOptions, remote = 'origin', branch?: string, pushOptions?: GitPushOptions): boolean {
  if (!isValidRemoteName(remote)) {
    return false
  }
  const args: string[] = ['push', remote]

  if (branch) {
    args.push(branch)
  }
  if (pushOptions?.force) {
    args.push('--force')
  }
  if (pushOptions?.setUpstream) {
    args.push('--set-upstream')
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout * 3,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Gets the URL of a remote.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @param remoteName - Name of the remote (defaults to 'origin')
 * @returns The remote URL, or null if not found
 *
 * @example Reading the origin URL
 * ```typescript
 * const url = getRemoteUrl({ cwd: '/path/to/repo', timeout: 30000 })
 * ```
 */
export function getRemoteUrl(options: GitCommandOptions, remoteName = 'origin'): string | null {
  if (!isValidRemoteName(remoteName)) {
    return null
  }
  try {
    const output = execFileSync('git', ['remote', 'get-url', remoteName], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output.trim() || null
  } catch {
    return null
  }
}
