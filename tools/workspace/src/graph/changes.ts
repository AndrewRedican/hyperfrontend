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
import { nxIgnores } from './workspace'

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
 * The changes `git diff --name-status -z` lists: a status, then one path, or two for a rename or
 * copy.
 *
 * @param output - The NUL-separated output
 * @returns The changes, in git's order
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
 * tree when the head is null, less what `.nxignore` leaves out.
 *
 * @param root - The workspace root, absolute
 * @param base - The base revision
 * @param head - The head revision, or null for the working tree
 * @returns The change set, sorted by path
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
  const ignores = nxIgnores(root)
  return {
    base: mergeBase,
    head,
    changes: [...changes.values()]
      .filter((change) => !matchesAny(ignores, change.path))
      .sort((left, right) => compareText(left.path, right.path)),
  }
}
