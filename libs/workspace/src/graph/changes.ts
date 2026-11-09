/**
 * The files that changed between two revisions, read from git with renames detected: from the
 * merge base of the two revisions to the head, or to the working tree with its untracked files
 * when no head is given, the way Nx frames an affected range.
 *
 * @module graph/changes
 */

import type { ChangeSet, ChangeStatus, FileChange } from './selection'
import { execFileSync } from 'node:child_process'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { matchesAny } from '@hyperfrontend/linter/helpers'
import { compareText } from './order'
import { ignoredPatterns } from './workspace'

/** The base the commands compare with when none is named: the main branch as the remote has it. */
export const DEFAULT_BASE = 'origin/main'

/** The base a repository without that remote branch is compared with instead. */
const LOCAL_MAIN = 'main'

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/** The change status of a `git diff --name-status` letter. */
const STATUSES: Readonly<Record<string, ChangeStatus>> = {
  A: 'added',
  C: 'added',
  M: 'modified',
  T: 'modified',
  D: 'deleted',
  R: 'renamed',
}

/**
 * Runs git in the workspace.
 *
 * @param root - The workspace root, absolute
 * @param args - The arguments after `git`
 * @returns The standard output
 */
function git(root: string, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8', maxBuffer: LIST_BUFFER, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Whether a revision names a commit of the repository.
 *
 * @param root - The workspace root, absolute
 * @param revision - The revision asked about
 * @returns True when git resolves it to a commit
 */
function isCommit(root: string, revision: string): boolean {
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`])
    return true
  } catch {
    return false
  }
}

/**
 * The revision a base names, verified against the repository: the base itself when it is a
 * commit; `main` when the default base is asked for and the repository has no `origin/main`,
 * as a repository that was never pushed has none; null when neither is a commit, as in a
 * repository with no commits yet.
 *
 * @param root - The workspace root, absolute
 * @param base - The base as written, or the default
 * @returns The revision to compare with, or null when the repository has none to offer
 *
 * @example A repository with no remote compares with its own main
 * ```typescript
 * resolveBase(root, DEFAULT_BASE) // => 'origin/main' once pushed, 'main' before, null with no commits
 * resolveBase(root, 'v1.2.0') // => 'v1.2.0', or null when there is no such tag
 * ```
 */
export function resolveBase(root: string, base: string): string | null {
  return (base === DEFAULT_BASE ? [base, LOCAL_MAIN] : [base]).find((candidate) => isCommit(root, candidate)) ?? null
}

/**
 * The changes `git diff --name-status -z` lists: a status, then one path, or two for a rename or
 * copy.
 *
 * @param output - The NUL-separated output
 * @returns The changes, in git's order
 *
 * @example A rename carries two paths, a copy counts as an addition
 * ```typescript
 * parseNameStatus('M\0libs/a.ts\0R100\0libs/old.ts\0libs/new.ts\0C75\0libs/x.ts\0libs/y.ts\0')
 * // => [
 * //   { status: 'modified', path: 'libs/a.ts', previousPath: null },
 * //   { status: 'renamed', path: 'libs/new.ts', previousPath: 'libs/old.ts' },
 * //   { status: 'added', path: 'libs/y.ts', previousPath: null },
 * // ]
 * ```
 */
export function parseNameStatus(output: string): FileChange[] {
  const fields = output.split('\0').filter((field) => field !== '')
  const changes: FileChange[] = []
  for (let index = 0; index < fields.length; ) {
    const letter = (fields[index] as string).charAt(0)
    const status = STATUSES[letter] ?? 'modified'
    if (letter === 'R' || letter === 'C') {
      const [previous = '', path = ''] = fields.slice(index + 1, index + 3)
      changes.push({ status, path, previousPath: letter === 'R' ? previous : null })
      index += 3
    } else {
      changes.push({ status, path: fields[index + 1] as string, previousPath: null })
      index += 2
    }
  }
  return changes
}

/**
 * The files that changed from the merge base of two revisions to the head, or to the working
 * tree when the head is null, less what `.hfignore` leaves out.
 *
 * @param root - The workspace root, absolute
 * @param base - The base revision
 * @param head - The head revision, or null for the working tree
 * @returns The change set, sorted by path
 *
 * @example The working tree against `main`, untracked files included
 * ```typescript
 * const changes = changeSet(root, 'main', null)
 * changes.base // => 'a1b2c3...', the merge base rather than main's tip
 * changes.head // => null
 * changes.changes // => [{ status: 'added', path: 'libs/features/src/new.ts', previousPath: null }, ...]
 * ```
 *
 * @example Two commits, as CI frames a pull request
 * ```typescript
 * changeSet(root, 'origin/main', 'HEAD').head // => 'HEAD'
 * ```
 */
export function changeSet(root: string, base: string, head: string | null): ChangeSet {
  const mergeBase = git(root, ['merge-base', base, head ?? 'HEAD']).trim()
  const changes = createMap<string, FileChange>()
  for (const change of parseNameStatus(git(root, ['diff', '--name-status', '-M', '-z', mergeBase, ...(head === null ? [] : [head])])))
    changes.set(change.path, change)
  if (head === null) {
    for (const path of git(root, ['ls-files', '-o', '--exclude-standard', '-z']).split('\0')) {
      if (path !== '' && !changes.has(path)) changes.set(path, { status: 'added', path, previousPath: null })
    }
  }
  const ignores = ignoredPatterns(root)
  return {
    base: mergeBase,
    head,
    changes: [...changes.values()]
      .filter((change) => !matchesAny(ignores, change.path))
      .sort((left, right) => compareText(left.path, right.path)),
  }
}
