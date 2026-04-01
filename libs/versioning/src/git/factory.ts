import type { GitCommit } from './models/commit'
import type { GitRef } from './models/ref'
import type { GitTag } from './models/tag'
import type { CreateCommitOptions } from './operations/commit'
import type { FileChange, GitCommitWithFiles } from './operations/diff'
import type { GitLogOptions } from './operations/log'
import type { CreateTagOptions } from './operations/manage-tags'
import type { GitOperationState } from './operations/operation-state'
import type { ListTagsOptions } from './operations/query-tags'
import type { StageOptions, DiscardChangesOptions } from './operations/stage'
import type { RepositoryStatus } from './operations/status'
import { execFileSync } from 'node:child_process'
import { createGitRef } from './models/ref'
import { commit, amendCommit, createEmptyCommit } from './operations/commit'
import { getChangedFilesBetween, getChangedFilesBetweenWithStatus, getCommitWithFiles } from './operations/diff'
import { getHead, getCurrentBranch, hasUntrackedFiles } from './operations/head-info'
import { getCommitLog, getCommitsBetween, getCommitsSince, getCommit, commitExists, commitReachableFromHead } from './operations/log'
import { createTag, deleteTag, pushTag } from './operations/manage-tags'
import { getOperationState, isOperationInProgress } from './operations/operation-state'
import { getTags, getTag, tagExists, getLatestTag, getTagsForPackage } from './operations/query-tags'
import { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges, discardChanges, discardAllChanges } from './operations/stage'
import {
  getStatus,
  isClean,
  isGitRepository,
  getRepositoryRoot,
  getHeadHash,
  getHeadShortHash,
  hasConflicts,
  getAheadCount,
  getBehindCount,
  needsPush,
  needsPull,
  getStagedFiles,
  getModifiedFiles,
  getUntrackedFiles,
} from './operations/status'

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
 */
function isValidRemoteName(remote: string): boolean {
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
 * Git client configuration.
 */
export interface GitClientConfig {
  /** Working directory */
  readonly cwd?: string

  /** Default timeout in milliseconds */
  readonly timeout?: number

  /** Whether to throw on errors */
  readonly throwOnError?: boolean
}

/**
 * Git client interface.
 *
 * Provides a unified interface for all git operations
 * within a specific working directory.
 */
export interface GitClient {
  /** Working directory */
  readonly cwd: string

  /** Default timeout */
  readonly timeout: number

  /**
   * Gets the commit log.
   */
  getCommitLog(options?: Omit<GitLogOptions, 'cwd'>): readonly GitCommit[]

  /**
   * Gets commits between two references.
   */
  getCommitsBetween(from: string, to?: string, options?: Omit<GitLogOptions, 'cwd' | 'from' | 'to'>): readonly GitCommit[]

  /**
   * Gets commits since a reference.
   */
  getCommitsSince(since: string, options?: Omit<GitLogOptions, 'cwd' | 'from'>): readonly GitCommit[]

  /**
   * Gets a single commit by hash.
   */
  getCommit(hash: string): GitCommit | null

  /**
   * Checks if a commit exists.
   */
  commitExists(hash: string): boolean

  /**
   * Checks if a commit is reachable from HEAD (i.e., is an ancestor of HEAD).
   *
   * Use this to verify an external commit reference before using it for
   * range queries. Detects if history was rewritten after the reference was recorded.
   */
  commitReachableFromHead(hash: string): boolean

  /**
   * Gets files changed between two refs.
   */
  getChangedFilesBetween(base: string, head?: string): readonly string[]

  /**
   * Gets files changed between two refs with status.
   */
  getChangedFilesBetweenWithStatus(base: string, head?: string): readonly FileChange[]

  /**
   * Gets a commit with its changed files.
   */
  getCommitWithFiles(hash: string): GitCommitWithFiles | null

  /**
   * Gets all tags.
   */
  getTags(options?: Omit<ListTagsOptions, 'cwd'>): readonly GitTag[]

  /**
   * Gets a specific tag.
   */
  getTag(name: string): GitTag | null

  /**
   * Creates a tag.
   */
  createTag(name: string, options?: Omit<CreateTagOptions, 'cwd'>): GitTag

  /**
   * Deletes a tag.
   */
  deleteTag(name: string): boolean

  /**
   * Checks if a tag exists.
   */
  tagExists(name: string): boolean

  /**
   * Gets the latest tag.
   */
  getLatestTag(options?: Omit<ListTagsOptions, 'cwd'>): GitTag | null

  /**
   * Gets tags for a specific package.
   */
  getTagsForPackage(packageName: string, options?: Omit<ListTagsOptions, 'cwd'>): readonly GitTag[]

  /**
   * Pushes a tag to remote.
   */
  pushTag(name: string, remote?: string): boolean

  /**
   * Creates a commit.
   */
  createCommit(message: string, options?: Omit<CreateCommitOptions, 'cwd'>): GitCommit

  /**
   * Stages files for commit.
   */
  stage(files: readonly string[], options?: Omit<StageOptions, 'cwd'>): boolean

  /**
   * Unstages files.
   */
  unstage(files: readonly string[]): boolean

  /**
   * Stages all changes.
   */
  stageAll(): boolean

  /**
   * Amends the last commit.
   */
  amendCommit(message: string, options?: Omit<CreateCommitOptions, 'cwd' | 'amend'>): GitCommit

  /**
   * Creates an empty commit.
   */
  createEmptyCommit(message: string, options?: Omit<CreateCommitOptions, 'cwd' | 'allowEmpty'>): GitCommit

  /**
   * Gets the HEAD commit hash.
   */
  getHead(): string | null

  /**
   * Gets the current branch name.
   */
  getCurrentBranch(): string | null

  /**
   * Checks if there are staged changes.
   */
  hasStagedChanges(): boolean

  /**
   * Checks if there are unstaged changes.
   */
  hasUnstagedChanges(): boolean

  /**
   * Discards uncommitted changes to tracked files.
   *
   * **Warning:** Destructive operation — discarded changes cannot be recovered.
   */
  discardChanges(options?: Omit<DiscardChangesOptions, 'cwd'>): boolean

  /**
   * Discards all changes and unstages all files.
   *
   * **Warning:** Destructive operation — discarded changes cannot be recovered.
   */
  discardAllChanges(): boolean

  /**
   * Checks if there are untracked files.
   */
  hasUntrackedFiles(): boolean

  /**
   * Gets the full repository status.
   */
  getStatus(): RepositoryStatus

  /**
   * Checks if the working tree is clean.
   */
  isClean(): boolean

  /**
   * Checks if this is a git repository.
   */
  isGitRepository(): boolean

  /**
   * Gets the repository root.
   */
  getRepositoryRoot(): string | null

  /**
   * Gets the HEAD hash.
   */
  getHeadHash(): string | null

  /**
   * Gets the short HEAD hash.
   */
  getHeadShortHash(): string | null

  /**
   * Checks if there are merge conflicts.
   */
  hasConflicts(): boolean

  /**
   * Gets the number of commits ahead of upstream.
   */
  getAheadCount(): number

  /**
   * Gets the number of commits behind upstream.
   */
  getBehindCount(): number

  /**
   * Checks if push is needed.
   */
  needsPush(): boolean

  /**
   * Checks if pull is needed.
   */
  needsPull(): boolean

  /**
   * Gets staged file paths.
   */
  getStagedFiles(): readonly string[]

  /**
   * Gets modified file paths.
   */
  getModifiedFiles(): readonly string[]

  /**
   * Gets untracked file paths.
   */
  getUntrackedFiles(): readonly string[]

  /**
   * Gets the current git operation state.
   *
   * Detects if git is in the middle of an incomplete operation such as
   * a rebase or merge.
   */
  getOperationState(): GitOperationState

  /**
   * Checks if an operation (rebase, merge) is in progress.
   */
  isOperationInProgress(): boolean

  /**
   * Gets all refs (branches, tags, remotes).
   */
  getRefs(): readonly GitRef[]

  /**
   * Gets local branches.
   */
  getBranches(): readonly GitRef[]

  /**
   * Gets remote tracking branches.
   */
  getRemoteBranches(remote?: string): readonly GitRef[]

  /**
   * Fetches from remote.
   */
  fetch(remote?: string, options?: { prune?: boolean; tags?: boolean }): boolean

  /**
   * Pulls from remote.
   */
  pull(remote?: string, branch?: string): boolean

  /**
   * Pushes to remote.
   */
  push(remote?: string, branch?: string, options?: { force?: boolean; setUpstream?: boolean }): boolean

  /**
   * Gets the URL of a remote.
   *
   * @param remoteName - Name of the remote (defaults to 'origin')
   * @returns The remote URL, or null if not found
   */
  getRemoteUrl(remoteName?: string): string | null
}

/**
 * Default git client configuration.
 */
export const DEFAULT_GIT_CLIENT_CONFIG: Required<Omit<GitClientConfig, 'cwd'>> & { cwd: string } = {
  cwd: process.cwd(),
  timeout: 30000,
  throwOnError: true,
}

/**
 * Creates a git client for a specific working directory.
 *
 * @param config - Client configuration
 * @returns GitClient instance
 *
 * @example
 * const git = createGitClient({ cwd: '/path/to/repo' })
 * const status = git.getStatus()
 * const commits = git.getCommitsSince('v1.0.0')
 */
export function createGitClient(config: GitClientConfig = {}): GitClient {
  const cwd = config.cwd ?? process.cwd()
  const timeout = config.timeout ?? DEFAULT_GIT_CLIENT_CONFIG.timeout

  const opts = { cwd, timeout }

  return {
    cwd,
    timeout,

    getCommitLog: (options) => getCommitLog({ ...opts, ...options }),
    getCommitsBetween: (from, to, options) => getCommitsBetween(from, to, { ...opts, ...options }),
    getCommitsSince: (since, options) => getCommitsSince(since, { ...opts, ...options }),
    getCommit: (hash) => getCommit(hash, opts),
    commitExists: (hash) => commitExists(hash, opts),
    commitReachableFromHead: (hash) => commitReachableFromHead(hash, opts),

    getChangedFilesBetween: (base, head) => getChangedFilesBetween(base, head, opts),
    getChangedFilesBetweenWithStatus: (base, head) => getChangedFilesBetweenWithStatus(base, head, opts),
    getCommitWithFiles: (hash) => getCommitWithFiles(hash, opts),

    getTags: (options) => getTags({ ...opts, ...options }),
    getTag: (name) => getTag(name, opts),
    createTag: (name, options) => createTag(name, { ...opts, ...options }),
    deleteTag: (name) => deleteTag(name, opts),
    tagExists: (name) => tagExists(name, opts),
    getLatestTag: (options) => getLatestTag({ ...opts, ...options }),
    getTagsForPackage: (packageName, options) => getTagsForPackage(packageName, { ...opts, ...options }),
    pushTag: (name, remote) => pushTag(name, remote, opts),

    createCommit: (message, options) => commit(message, { ...opts, ...options }),
    stage: (files, options) => stage(files, { ...opts, ...options }),
    unstage: (files) => unstage(files, opts),
    stageAll: () => stageAll(opts),
    amendCommit: (message, options) => amendCommit(message, { ...opts, ...options }),
    createEmptyCommit: (message, options) => createEmptyCommit(message, { ...opts, ...options }),
    getHead: () => getHead(opts),
    getCurrentBranch: () => getCurrentBranch(opts),
    hasStagedChanges: () => hasStagedChanges(opts),
    hasUnstagedChanges: () => hasUnstagedChanges(opts),
    discardChanges: (options) => discardChanges({ ...opts, ...options }),
    discardAllChanges: () => discardAllChanges(opts),
    hasUntrackedFiles: () => hasUntrackedFiles(opts),

    getStatus: () => getStatus(opts),
    isClean: () => isClean(opts),
    isGitRepository: () => isGitRepository(opts),
    getRepositoryRoot: () => getRepositoryRoot(opts),
    getHeadHash: () => getHeadHash(opts),
    getHeadShortHash: () => getHeadShortHash(opts),
    hasConflicts: () => hasConflicts(opts),
    getAheadCount: () => getAheadCount(opts),
    getBehindCount: () => getBehindCount(opts),
    needsPush: () => needsPush(opts),
    needsPull: () => needsPull(opts),
    getStagedFiles: () => getStagedFiles(opts),
    getModifiedFiles: () => getModifiedFiles(opts),
    getUntrackedFiles: () => getUntrackedFiles(opts),

    getOperationState: () => getOperationState(opts),
    isOperationInProgress: () => isOperationInProgress(opts),

    getRefs: () => getRefs(opts),
    getBranches: () => getBranches(opts),
    getRemoteBranches: (remote) => getRemoteBranches(opts, remote),
    fetch: (remote, options) => fetch(opts, remote, options),
    pull: (remote, branch) => pull(opts, remote, branch),
    push: (remote, branch, options) => push(opts, remote, branch, options),
    getRemoteUrl: (remoteName) => getRemoteUrl(opts, remoteName),
  }
}

/**
 * Gets all refs from the repository.
 *
 * @param options - Configuration object containing cwd and timeout
 * @param options.cwd - Working directory for the git command
 * @param options.timeout - Command timeout in milliseconds
 * @returns Array of GitRef objects representing all refs in the repository
 */
function getRefs(options: { cwd: string; timeout: number }): readonly GitRef[] {
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
 */
function getBranches(options: { cwd: string; timeout: number }): readonly GitRef[] {
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
 */
function getRemoteBranches(options: { cwd: string; timeout: number }, remote?: string): readonly GitRef[] {
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
 */
function fetch(options: { cwd: string; timeout: number }, remote = 'origin', fetchOptions?: { prune?: boolean; tags?: boolean }): boolean {
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
 */
function pull(options: { cwd: string; timeout: number }, remote = 'origin', branch?: string): boolean {
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
 */
function push(
  options: { cwd: string; timeout: number },
  remote = 'origin',
  branch?: string,
  pushOptions?: { force?: boolean; setUpstream?: boolean }
): boolean {
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
 */
function getRemoteUrl(options: { cwd: string; timeout: number }, remoteName = 'origin'): string | null {
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
