/**
 * What a run stood on and who wrote its results: the working tree as a git tree, the commits a
 * pull request's checkout was merged from, the workflow run, and the files that differ between
 * two trees. A tree, not a commit, is what two runs are compared by, so a rebase, a force push, a
 * base branch that moved and a dirty working tree all read the same way.
 *
 * @module pipeline/tested
 */

import type { ChangeSet, FileChange } from '@hyperfrontend/workspace/graph'
import type { RunIdentity, Tested } from './model'
import type { GitHubEnvironment } from './siblings'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { floor } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { matchesAny } from '@hyperfrontend/linter/helpers'
import { compareText, ignoredPatterns, parseNameStatus } from '@hyperfrontend/workspace/graph'
import { runUrlOf } from './checks'

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/** Who a commit of a tree is written by, and when: fixed, so one tree always gives one commit. */
const TREE_COMMIT_IDENTITY: Readonly<Record<string, string>> = {
  GIT_AUTHOR_NAME: 'pipeline',
  GIT_AUTHOR_EMAIL: 'pipeline@localhost',
  GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
  GIT_COMMITTER_NAME: 'pipeline',
  GIT_COMMITTER_EMAIL: 'pipeline@localhost',
  GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
}

/**
 * Runs git in the workspace.
 *
 * @param root - The workspace root, absolute
 * @param args - The arguments after `git`
 * @param env - Environment entries set on top of the process environment
 * @returns The standard output, trimmed
 */
function git(root: string, args: readonly string[], env: Readonly<Record<string, string>> = {}): string {
  return execFileSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: LIST_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  }).trim()
}

/**
 * Why something failed, in one line: what a failed command wrote to standard error, which is
 * where git says which file and why, else the text of what was thrown.
 *
 * @param error - What was thrown
 * @returns The command's first line that says error or fatal, else its first line, else the first line of the error's text
 */
export function reasonOf(error: unknown): string {
  const said = error instanceof Error && 'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : ''
  if (said === '') return String(error).split(/\r?\n/, 1).join('')
  const lines = said.split(/\r?\n/)
  // why: git may write warnings and hints first, such as one per file whose line endings it will convert, and the reason is the line that says error or fatal
  return lines.find((line) => line.startsWith('error: ') || line.startsWith('fatal: ')) ?? (lines[0] as string)
}

/**
 * The tree of the working tree, untracked files included and ignored files left out, written from
 * a copy of the index so the real index is never touched. A clean checkout answers the tree of
 * its head commit.
 *
 * @param root - The workspace root, absolute
 * @returns The tree id
 */
export function testedTree(root: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'hf-tested-'))
  const index = join(directory, 'index')
  try {
    const real = resolve(root, git(root, ['rev-parse', '--git-path', 'index']))
    // why: a repository nothing was ever added to has no index, and git reads a missing index file as an empty one
    if (existsSync(real)) {
      copyFileSync(real, index)
      // why: git trusts an entry's recorded size and times unless the entry is as new as the index file itself, in which case it reads the content; a copy stamped now would make every such entry look settled, and a file rewritten at the same size in the second the index was written would go unseen. The copy keeps the time of the original, rounded down, which only ever makes git read more
      const writtenAt = floor(statSync(real).mtimeMs / 1000)
      utimesSync(index, writtenAt, writtenAt)
    }
    git(root, ['add', '-A'], { GIT_INDEX_FILE: index })
    return git(root, ['write-tree'], { GIT_INDEX_FILE: index })
  } finally {
    // why: on Windows a scanner may still hold the index git has just written, and a removal that throws here would take the place of the tree
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

/**
 * What a plan is made on: the tree of the working tree and, on a pull request, the commits
 * GitHub's checkout was merged from.
 *
 * @param root - The workspace root, absolute
 * @param pullRequest - Whether the checkout is a pull request's, which is GitHub's merge of the head into the base
 * @returns The tree, with the head, base and merge commits when the head commit is such a merge and null otherwise
 */
export function testedOf(root: string, pullRequest: boolean): Tested {
  const tree = testedTree(root)
  const [merge, base, head, ...more] = pullRequest ? git(root, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ') : []
  // why: only a commit with exactly two parents is a merge of a head into a base
  if (merge === undefined || base === undefined || head === undefined || more.length > 0)
    return { tree, head: null, base: null, merge: null }
  return { tree, head, base, merge }
}

/**
 * What a plan is made on, when it can be told. Recording it only serves a later run that inherits
 * from this one, so a tree that cannot be written costs the inheritance and never the plan.
 *
 * @param root - The workspace root, absolute
 * @param pullRequest - Whether the checkout is a pull request's
 * @param report - Receives one line when the tree cannot be written
 * @returns What the plan is made on, or null when git could not write the tree, as with an untracked file it cannot read
 */
export function testedOrNull(root: string, pullRequest: boolean, report: (line: string) => void): Tested | null {
  try {
    return testedOf(root, pullRequest)
  } catch (error) {
    report(`nothing is inherited by this run or from it: the tree of the working tree could not be written (${reasonOf(error)})`)
    return null
  }
}

/**
 * A parentless commit of a tree, which is what a checkout of the tree needs. The identity and
 * both dates are fixed, so it needs no configured identity and answers one id per tree.
 *
 * @param root - The workspace root, absolute
 * @param tree - The tree id
 * @returns The commit id
 */
export function treeCommit(root: string, tree: string): string {
  // why: a configured commit encoding other than UTF-8 adds a header to the commit, and with it another id
  return git(
    root,
    ['-c', 'i18n.commitEncoding=UTF-8', 'commit-tree', '--no-gpg-sign', '-m', 'the tree a pipeline run stood on', tree],
    TREE_COMMIT_IDENTITY
  )
}

/**
 * A change as the selection may see it, given which paths are left out. A rename with one side
 * left out is not dropped whole: the side that counts stays, as the deletion of the old path or
 * the addition of the new one, since a task that read the old path must still hear it is gone.
 *
 * @param change - One change git listed
 * @param ignored - Whether a path is left out
 * @returns The change, the half of a rename that counts, or nothing
 */
function visibleChange(change: FileChange, ignored: (path: string) => boolean): FileChange[] {
  const { path, previousPath } = change
  if (previousPath === null || ignored(previousPath) === ignored(path)) return ignored(path) ? [] : [change]
  return ignored(path) ? [{ status: 'deleted', path: previousPath, previousPath: null }] : [{ status: 'added', path, previousPath: null }]
}

/**
 * The files that differ between two trees, less what `.hfignore` leaves out: no merge base, no
 * index, no working tree.
 *
 * @param root - The workspace root, absolute
 * @param from - The earlier tree, or a commit of it, which a reader of the base's files needs
 * @param to - The later tree, or a commit of it
 * @returns The change set from the one to the other, sorted by path; a rename into or out of what is left out counts as a deletion or an addition
 */
export function changesBetween(root: string, from: string, to: string): ChangeSet {
  const ignores = ignoredPatterns(root)
  return {
    base: from,
    head: to,
    changes: parseNameStatus(git(root, ['diff', '--name-status', '-M', '-z', from, to]))
      .flatMap((change) => visibleChange(change, (path) => matchesAny(ignores, path)))
      .sort((left, right) => compareText(left.path, right.path)),
  }
}

/**
 * The workflow run a results file is written by.
 *
 * @param env - The GitHub environment
 * @param sha - The head commit the run is for
 * @returns The run, or null when the environment names no run or no commit, as on this machine
 */
export function runIdentity(env: GitHubEnvironment, sha: string | undefined): RunIdentity | null {
  const { GITHUB_RUN_ID: id } = env
  if (id === undefined || id === '' || sha === undefined) return null
  return { id: Number(id), attempt: Number(env.GITHUB_RUN_ATTEMPT ?? '1'), sha, url: runUrlOf(env) }
}
