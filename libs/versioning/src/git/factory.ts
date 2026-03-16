import type { GitCommit } from './models/commit'
import type { GitRef } from './models/ref'
import type { GitTag } from './models/tag'
import type { CreateCommitOptions } from './operations/commit'
import type { GitLogOptions } from './operations/log'
import type { CreateTagOptions } from './operations/manage-tags'
import type { ListTagsOptions } from './operations/query-tags'
import type { StageOptions } from './operations/stage'
import type { RepositoryStatus } from './operations/status'
import { execSync } from 'node:child_process'
import { createGitRef } from './models/ref'
import { commit, amendCommit, createEmptyCommit } from './operations/commit'
import { getHead, getCurrentBranch, hasUntrackedFiles } from './operations/head-info'
import { getCommitLog, getCommitsBetween, getCommitsSince, getCommit, commitExists } from './operations/log'
import { createTag, deleteTag, pushTag } from './operations/manage-tags'
import { getTags, getTag, tagExists, getLatestTag, getTagsForPackage } from './operations/query-tags'
import { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges } from './operations/stage'
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

  // ========== Log Operations ==========

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

  // ========== Tag Operations ==========

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

  // ========== Commit Operations ==========

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
   * Checks if there are untracked files.
   */
  hasUntrackedFiles(): boolean

  // ========== Status Operations ==========

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

  // ========== Ref Operations ==========

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

    // Log operations
    getCommitLog: (options) => getCommitLog({ ...opts, ...options }),
    getCommitsBetween: (from, to, options) => getCommitsBetween(from, to, { ...opts, ...options }),
    getCommitsSince: (since, options) => getCommitsSince(since, { ...opts, ...options }),
    getCommit: (hash) => getCommit(hash, opts),
    commitExists: (hash) => commitExists(hash, opts),

    // Tag operations
    getTags: (options) => getTags({ ...opts, ...options }),
    getTag: (name) => getTag(name, opts),
    createTag: (name, options) => createTag(name, { ...opts, ...options }),
    deleteTag: (name) => deleteTag(name, opts),
    tagExists: (name) => tagExists(name, opts),
    getLatestTag: (options) => getLatestTag({ ...opts, ...options }),
    getTagsForPackage: (packageName, options) => getTagsForPackage(packageName, { ...opts, ...options }),
    pushTag: (name, remote) => pushTag(name, remote, opts),

    // Commit operations
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
    hasUntrackedFiles: () => hasUntrackedFiles(opts),

    // Status operations
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

    // Ref operations
    getRefs: () => getRefs(opts),
    getBranches: () => getBranches(opts),
    getRemoteBranches: (remote) => getRemoteBranches(opts, remote),
    fetch: (remote, options) => fetch(opts, remote, options),
    pull: (remote, branch) => pull(opts, remote, branch),
    push: (remote, branch, options) => push(opts, remote, branch, options),
  }
}

// ============================================================================
// Additional ref operations used by the client
// ============================================================================

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
    const output = execSync('git show-ref', {
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

      // Format: <hash> <refname>
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
  const args: string[] = ['fetch', remote]

  if (fetchOptions?.prune) {
    args.push('--prune')
  }
  if (fetchOptions?.tags) {
    args.push('--tags')
  }

  try {
    execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout * 3, // Allow more time for network
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
  const args: string[] = ['pull', remote]
  if (branch) {
    args.push(branch)
  }

  try {
    execSync(`git ${args.join(' ')}`, {
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
    execSync(`git ${args.join(' ')}`, {
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
