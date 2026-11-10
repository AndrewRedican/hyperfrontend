/**
 * The graph of a workspace as it stood at another revision: the revision is checked out in a
 * temporary git worktree, the graph built there without persisting anything, and the worktree
 * removed. The selection reads it as the previous graph, so a module deleted or renamed together
 * with its importers still names the tasks that read it before the change.
 *
 * @module graph/revision
 */

import type { WorkspaceGraph } from './build'
import type { WorkspaceFile } from './inputs'
import type { ChangeSet } from './selection'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { buildGraph } from './build'
import { CACHE_FILE } from './imports'
import { readWorkspaceFile } from './inputs'

/** The directory under `node_modules` the checkout keeps to itself. */
const CACHE_DIRECTORY = '.cache'

/**
 * Runs git in a repository with no hooks, so a checkout runs nothing the repository installs.
 *
 * @param cwd - The repository root
 * @param hooks - An empty directory that stands in for the hooks
 * @param args - The arguments after `git`
 */
function git(cwd: string, hooks: string, args: readonly string[]): void {
  execFileSync('git', ['-c', `core.hooksPath=${hooks}`, ...args], { cwd, stdio: 'ignore' })
}

/**
 * Lends the checkout the workspace's installed packages: each entry of `node_modules` linked,
 * so a package resolves as it does in the workspace, and the import cache copied, so files whose
 * content is unchanged are not parsed again and the workspace's own cache is never rewritten.
 *
 * @param root - The workspace root, absolute
 * @param checkout - The checkout, absolute
 */
function lendPackages(root: string, checkout: string): void {
  const installed = join(root, 'node_modules')
  if (!existsSync(installed)) return
  mkdirSync(join(checkout, 'node_modules'))
  for (const name of readdirSync(installed)) {
    if (name !== CACHE_DIRECTORY) symlinkSync(join(installed, name), join(checkout, 'node_modules', name), 'junction')
  }
  if (!existsSync(join(root, CACHE_FILE))) return
  mkdirSync(dirname(join(checkout, CACHE_FILE)), { recursive: true })
  copyFileSync(join(root, CACHE_FILE), join(checkout, CACHE_FILE))
}

/**
 * Runs work in a temporary worktree of a revision, removed when the work ends.
 *
 * @param root - The workspace root, absolute
 * @param revision - The commit checked out
 * @param work - What runs, given the checkout's absolute root
 * @returns What the work returned
 *
 * @example Reading a file as it stood at `main`
 * ```typescript
 * const manifest = withRevision(root, 'main', (checkout) => readJson<{ version?: string }>(join(checkout, 'libs/features/package.json')))
 * manifest?.version // => '0.11.1'
 * // the checkout is gone by now; the workspace's node_modules were linked into it, never copied
 * ```
 */
export function withRevision<Result>(root: string, revision: string, work: (checkout: string) => Result): Result {
  const directory = mkdtempSync(join(tmpdir(), 'hf-revision-'))
  const checkout = join(directory, 'checkout')
  try {
    git(root, directory, ['worktree', 'add', '--detach', checkout, revision])
    try {
      lendPackages(root, checkout)
      return work(checkout)
    } finally {
      git(root, directory, ['worktree', 'remove', '--force', checkout])
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * The graph of a workspace at a revision.
 *
 * @param root - The workspace root, absolute
 * @param revision - The commit whose graph is built
 * @returns The graph, rooted at a checkout that no longer exists once it is returned
 *
 * @example The graph answers from memory, its root does not exist
 * ```typescript
 * const before = graphAtRevision(root, 'main')
 * before.projects.has('lib-removed') // => true, when main still had the project
 * existsSync(before.root) // => false
 * ```
 */
export function graphAtRevision(root: string, revision: string): WorkspaceGraph {
  return withRevision(root, revision, (checkout) => {
    // why: the selection reads the target defaults by the graph's root after the checkout is gone, so they are read while it stands.
    readWorkspaceFile(checkout)
    return buildGraph(checkout)
  })
}

/**
 * The graph at the base of a change set, when the selection needs it: only a deleted or renamed
 * path asks what read it before the change.
 *
 * @param root - The workspace root, absolute
 * @param changes - The change set, or null for a selection of everything
 * @returns The graph at the change set's base, or undefined when no change removed a path
 *
 * @example Built only when a path was deleted or renamed
 * ```typescript
 * const changes = changeSet(root, 'main', null)
 * const previous = previousGraph(root, changes) // => undefined for edits and additions alone
 * selectAffected({ graph: workspaceGraph(root), changes, targets: ['test'], previous })
 * ```
 */
export function previousGraph(root: string, changes: ChangeSet | null): WorkspaceGraph | undefined {
  if (changes === null || !changes.changes.some((change) => change.status === 'deleted' || change.status === 'renamed')) return undefined
  return graphAtRevision(root, changes.base)
}

/** The workspace file, read at the base when the change set touched it. */
const WORKSPACE_FILE = 'hf.json'

/**
 * The `hf.json` as it stood at the base of a change set, when the selection needs it: only a
 * change to the file asks what each task resolved to before.
 *
 * @param root - The workspace root, absolute
 * @param changes - The change set, or null for a selection of everything
 * @returns The file's content at the base, empty where the base had none, or undefined when the change set leaves the file alone
 *
 * @example Read only when the file changed
 * ```typescript
 * const changes = changeSet(root, 'main', null)
 * const previousWorkspace = previousWorkspaceFile(root, changes) // => undefined unless hf.json is among the changes
 * selectAffected({ graph: workspaceGraph(root), changes, targets: ['test'], previousWorkspace })
 * ```
 */
export function previousWorkspaceFile(root: string, changes: ChangeSet | null): WorkspaceFile | undefined {
  if (changes === null || !changes.changes.some((change) => change.path === WORKSPACE_FILE || change.previousPath === WORKSPACE_FILE))
    return undefined
  try {
    return parse(
      execFileSync('git', ['show', `${changes.base}:${WORKSPACE_FILE}`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    ) as WorkspaceFile
  } catch {
    // why: a base without the file, or with one that does not parse, is the empty configuration the engine assumes without it
    return {}
  }
}
