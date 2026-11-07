/**
 * The safety net of a run that edits the working tree before it commits: a snapshot of the tree
 * as it stood before the run, and the way back to exactly that state. The way back restores what
 * the developer had, uncommitted edits included, and never what `HEAD` holds in their place.
 *
 * @module executors/version-batch/lib/working-tree
 */

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The largest output git may answer with. */
const BUFFER = 64 * 1024 * 1024

/** Who the snapshot commit is made as. */
const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: 'hf',
  GIT_AUTHOR_EMAIL: 'hf@localhost',
  GIT_COMMITTER_NAME: 'hf',
  GIT_COMMITTER_EMAIL: 'hf@localhost',
}

/** A working tree as it stood at one moment. */
export interface TreeSnapshot {
  /** The commit git made of the uncommitted changes to tracked files, staged and unstaged, or null when there were none. */
  readonly changes: string | null
  /** The untracked files the tree held, workspace-relative. */
  readonly untracked: ReadonlySet<string>
}

/**
 * Runs git in a workspace.
 *
 * @param root - The workspace root, absolute
 * @param args - The git arguments
 * @param env - The environment git runs in
 * @returns What git printed
 */
function git(root: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env, maxBuffer: BUFFER, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * The untracked files of a workspace that git does not ignore.
 *
 * @param root - The workspace root, absolute
 * @returns The files, workspace-relative
 */
function untrackedFiles(root: string): string[] {
  return git(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter((file) => file !== '')
}

/**
 * Records a working tree without touching it.
 *
 * @param root - The workspace root, absolute
 * @returns The uncommitted changes to tracked files, as a commit only this snapshot names, and the untracked files
 *
 * @example Recording a tree with edits in flight
 * ```typescript
 * snapshotWorkingTree(root)
 * // => { changes: '3f9c2e1...', untracked: Set { 'notes.md' } }; changes is null for a clean tree
 * ```
 */
export function snapshotWorkingTree(root: string): TreeSnapshot {
  // why: `stash create` builds the commit a stash would hold and leaves the tree, the index and the stash list alone; it prints nothing for a clean tree. The identity only labels that commit, and is given here so the snapshot works whatever identity git has, or lacks.
  const changes = git(root, ['stash', 'create'], { ...process.env, ...SNAPSHOT_IDENTITY }).trim()
  return { changes: changes === '' ? null : changes, untracked: createSet(untrackedFiles(root)) }
}

/**
 * Puts a working tree back the way a snapshot recorded it: the index and every tracked file as
 * they were, uncommitted edits included, and no file the tree did not have. An untracked file
 * the tree already had is left as it is now.
 *
 * @param root - The workspace root, absolute
 * @param snapshot - The tree as it stood
 *
 * @example Undoing a run's edits, not the developer's
 * ```typescript
 * const snapshot = snapshotWorkingTree(root)
 * writeFileSync(join(root, 'libs/core/package.json'), bumped)
 * writeFileSync(join(root, 'libs/core/CHANGELOG.md'), entry)
 * restoreWorkingTree(root, snapshot)
 * // libs/core/package.json holds the uncommitted edit it had before, and the new CHANGELOG.md is gone
 * ```
 */
export function restoreWorkingTree(root: string, snapshot: TreeSnapshot): void {
  // why: the second parent of the commit `stash create` makes is the index as it stood
  git(root, ['restore', `--source=${snapshot.changes === null ? 'HEAD' : `${snapshot.changes}^2`}`, '--staged', '--', '.'])
  git(root, ['restore', `--source=${snapshot.changes ?? 'HEAD'}`, '--worktree', '--', '.'])
  for (const file of untrackedFiles(root)) {
    if (!snapshot.untracked.has(file)) rmSync(join(root, file), { force: true })
  }
}

/**
 * Runs something that edits the working tree, and puts the tree back as it stood if the run
 * throws or the process is interrupted. A run that returns keeps its edits, and so does one that
 * has called `keep`: once the edits are committed there is nothing to put back, and putting the
 * old files back would undo the commit in the working tree.
 *
 * @param root - The workspace root, absolute
 * @param run - What edits the tree; it calls `keep` at the point its edits are final
 * @param note - Says a line about the rollback
 * @returns What the run returned
 * @throws {unknown} What the run threw, once the tree is back
 *
 * @example Calling `keep` once the edits are committed
 * ```typescript
 * const hash = await withRollback(
 *   root,
 *   async (keep) => {
 *     const files = await bumpManifests()
 *     const hash = commitBump(files)
 *     keep() // the bump is in history: an interrupt from here on puts nothing back
 *     return hash
 *   },
 *   (line) => process.stderr.write(`${line}\n`)
 * )
 * // a throw before keep() restores every file first, then rethrows
 * ```
 */
export async function withRollback<Result>(
  root: string,
  run: (keep: () => void) => Promise<Result>,
  note: (line: string) => void
): Promise<Result> {
  const snapshot = snapshotWorkingTree(root)
  let kept = false
  const putBack = (reason: string): void => {
    if (kept) return
    note(`${reason}, putting the working tree back as it stood...`)
    restoreWorkingTree(root, snapshot)
  }
  const interrupt = (): void => {
    putBack('Interrupted')
    process.exit(1)
  }
  const stopListening = (): void => {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', interrupt)
  }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  try {
    const result = await run(() => {
      kept = true
    })
    stopListening()
    return result
  } catch (error) {
    stopListening()
    putBack('Failed')
    throw error
  }
}
