/**
 * Replays history: for each merge on a branch, or for each commit, checks the head out in a
 * worktree that shares the installed `node_modules`, captures Nx's selection from the base to the
 * head, and keeps one JSON record per range. A revision whose Nx cannot run against the shared
 * `node_modules`, because its `nx.json` lists a plugin no longer installed, is reported and left
 * unrecorded.
 *
 * @module baseline/replay
 */

import type { BaselineSelection, ReplayedMerge, ReplayKind } from './model'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** A merge commit and the range it merged, or a commit and the range from its parent. */
export interface MergeRecord {
  /** The merge commit, or the commit itself. */
  readonly sha: string
  /** The merge base of the merge's parents, or the commit's parent. */
  readonly base: string
  /** The second parent of a merge, the merged branch's tip; the commit itself otherwise. */
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
  /** The branch whose history is replayed. */
  readonly ref: string
  /** Whether the merges on the branch are replayed, or its commits one by one. */
  readonly kind: ReplayKind
  /** How many merges or commits, newest first. */
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
 * The newest commits on a branch that have a parent, merges left out.
 *
 * @param cwd - The repository root
 * @param ref - The branch
 * @param count - How many commits
 * @returns The commits, newest first, each ranged against its parent
 */
export function listCommits(cwd: string, ref: string, count: number): MergeRecord[] {
  const log = git(cwd, ['log', '--no-merges', `--max-count=${count}`, `--format=%H${FIELD}%P${FIELD}%cI`, ref])
  if (log === '') return []
  return log
    .split(/\r?\n/)
    .map((line) => {
      const [sha = '', parent = '', committedAt = ''] = line.split(FIELD)
      return { sha, base: parent, head: sha, committedAt }
    })
    .filter((record) => record.base !== '')
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

/** What a failed child process leaves on an error, beside its message. */
interface ProcessFailure {
  /** The message, which for `execFileSync` starts with the command line. */
  readonly message: string
  /** What the process wrote to standard error, when it was piped. */
  readonly stderr?: string
}

/**
 * The first line worth reporting of a failure: what the process wrote to standard error when
 * there is any, else the message.
 *
 * @param error - What was thrown
 * @returns One line
 */
function firstLine(error: unknown): string {
  const failure = error as ProcessFailure
  const lines = `${failure.stderr ?? ''}\n${failure.message}`.split(/\r?\n/).map((line) => line.trim())
  return lines.find((line) => line !== '') ?? ''
}

/**
 * Replays the newest merges or commits of a branch, skipping those already recorded and those
 * whose Nx cannot run.
 *
 * @param options - The branch, the kind, the count, the output directory and the capture
 * @returns The records written, newest first; ranges already recorded or not replayable are skipped
 */
export function replayMerges(options: ReplayOptions): ReplayedMerge[] {
  mkdirSync(options.outDir, { recursive: true })
  const list = options.kind === 'merge' ? listMerges : listCommits
  return list(options.cwd, options.ref, options.count)
    .map((merge) => {
      const file = join(options.outDir, `${merge.sha}.json`)
      if (existsSync(file)) {
        options.report(`${merge.sha.slice(0, 12)} already recorded`)
        return null
      }
      let selection: BaselineSelection
      try {
        selection = withWorktree(options.cwd, merge.head, (checkout) => options.capture(checkout, merge.base, merge.head))
      } catch (error) {
        options.report(`${merge.sha.slice(0, 12)} not replayable: ${firstLine(error)}`)
        return null
      }
      const record: ReplayedMerge = { kind: options.kind, ...merge, lockfileSkew: lockfileSkew(options.cwd, merge.head), selection }
      writeFileSync(file, `${stringify(record, null, 2)}\n`)
      const affected = keys(selection.explanation.affected).length
      options.report(
        `${merge.sha.slice(0, 12)} ${selection.projects.length} projects, ${affected} tasks${record.lockfileSkew ? ', lockfile skew' : ''}`
      )
      return record
    })
    .filter((record): record is ReplayedMerge => record !== null)
}
