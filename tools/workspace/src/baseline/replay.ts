/**
 * Replays merged pull requests: for each merge on a branch, checks its head out in a worktree
 * that shares the installed `node_modules`, captures Nx's selection from the merge base to the
 * head, and keeps one JSON record per merge.
 *
 * @module baseline/replay
 */

import type { BaselineSelection, ReplayedMerge } from './model'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** A merge commit and the range it merged. */
export interface MergeRecord {
  /** The merge commit. */
  readonly sha: string
  /** The merge base of its parents. */
  readonly base: string
  /** The second parent: the merged branch's tip. */
  readonly head: string
  /** When the merge was committed, ISO 8601. */
  readonly committedAt: string
}

/** Captures Nx's selection inside a checkout. */
export type Capture = (checkout: string, base: string, head: string) => BaselineSelection

/** What a replay needs. */
export interface ReplayOptions {
  /** The repository root. */
  readonly cwd: string
  /** The branch whose merges are replayed. */
  readonly ref: string
  /** How many merges, newest first. */
  readonly count: number
  /** Where the records are written, one `<sha>.json` per merge. */
  readonly outDir: string
  /** Captures the selection inside the worktree. */
  readonly capture: Capture
  /** Receives one line per merge as the replay proceeds. */
  readonly report: (line: string) => void
}

/** The separator `git log` is asked to put between fields. */
const FIELD = '\u001f'

/**
 * Runs git in a directory and returns its trimmed output.
 *
 * @param cwd - The directory
 * @param args - The arguments after `git`
 * @returns The standard output without surrounding whitespace
 */
export function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/**
 * The newest merges on a branch, following its first parents.
 *
 * @param cwd - The repository root
 * @param ref - The branch
 * @param count - How many merges
 * @returns The merges, newest first
 */
export function listMerges(cwd: string, ref: string, count: number): MergeRecord[] {
  const log = git(cwd, ['log', '--merges', '--first-parent', `--max-count=${count}`, `--format=%H${FIELD}%P${FIELD}%cI`, ref])
  if (log === '') return []
  return log.split(/\r?\n/).map((line) => {
    const [sha = '', parents = '', committedAt = ''] = line.split(FIELD)
    const [first = '', second = ''] = parents.split(' ')
    return { sha, base: git(cwd, ['merge-base', first, second]), head: second, committedAt }
  })
}

/**
 * Whether the lock file at a revision differs from the working tree's, from which the shared
 * `node_modules` was installed.
 *
 * @param cwd - The repository root
 * @param revision - The revision to compare
 * @returns True when the two lock files differ
 */
export function lockfileSkew(cwd: string, revision: string): boolean {
  return git(cwd, ['rev-parse', `${revision}:package-lock.json`]) !== git(cwd, ['hash-object', 'package-lock.json'])
}

/**
 * Checks a revision out in a worktree that shares the repository's `node_modules`, runs the work
 * and removes the worktree afterwards, whether the work succeeded or threw.
 *
 * @param cwd - The repository root
 * @param revision - The revision to check out
 * @param work - The work, given the checkout's absolute path
 * @returns What the work returned
 */
export function withWorktree<Result>(cwd: string, revision: string, work: (checkout: string) => Result): Result {
  const checkout = join(cwd, '.hf', 'replay', 'worktrees', revision.slice(0, 12))
  // why: a replay interrupted mid-capture leaves its worktree behind, and git refuses to add one where a directory already stands.
  if (existsSync(checkout)) rmSync(checkout, { recursive: true, force: true })
  git(cwd, ['worktree', 'prune'])
  mkdirSync(join(cwd, '.hf', 'replay', 'worktrees'), { recursive: true })
  git(cwd, ['worktree', 'add', '--detach', checkout, revision])
  try {
    symlinkSync(join(cwd, 'node_modules'), join(checkout, 'node_modules'), 'junction')
    return work(checkout)
  } finally {
    git(cwd, ['worktree', 'remove', '--force', checkout])
  }
}

/**
 * Replays the newest merges of a branch, skipping those already recorded.
 *
 * @param options - The branch, the count, the output directory and the capture
 * @returns The records written, newest first; merges already recorded are skipped
 */
export function replayMerges(options: ReplayOptions): ReplayedMerge[] {
  mkdirSync(options.outDir, { recursive: true })
  return listMerges(options.cwd, options.ref, options.count)
    .map((merge) => {
      const file = join(options.outDir, `${merge.sha}.json`)
      if (existsSync(file)) {
        options.report(`${merge.sha.slice(0, 12)} already recorded`)
        return null
      }
      const selection = withWorktree(options.cwd, merge.head, (checkout) => options.capture(checkout, merge.base, merge.head))
      const record: ReplayedMerge = { ...merge, lockfileSkew: lockfileSkew(options.cwd, merge.head), selection }
      writeFileSync(file, `${stringify(record, null, 2)}\n`)
      const affected = keys(selection.explanation.affected).length
      options.report(
        `${merge.sha.slice(0, 12)} ${selection.projects.length} projects, ${affected} tasks${record.lockfileSkew ? ', lockfile skew' : ''}`
      )
      return record
    })
    .filter((record): record is ReplayedMerge => record !== null)
}
