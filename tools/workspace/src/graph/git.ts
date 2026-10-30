/**
 * The environment git runs with when it lists and hashes a workspace's files. A checkout answers
 * from its own repository; a tree without one, such as a deploy's source snapshot, answers from an
 * empty repository made for it, so every file reads as untracked and the ignore files still apply.
 *
 * @module graph/git
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** Each root to its environment, settled once per process. */
const environments = createMap<string, NodeJS.ProcessEnv | undefined>()

/**
 * Whether git finds a repository at or above a directory.
 *
 * @param root - The directory, absolute
 * @returns True when the directory is inside a repository
 */
function inRepository(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Creates an empty repository outside the tree, removed when the process exits, and points git at
 * it with the tree as its working tree.
 *
 * @param root - The tree, absolute
 * @returns The environment naming the repository and the working tree
 */
function detachedEnvironment(root: string): NodeJS.ProcessEnv {
  const directory = mkdtempSync(join(tmpdir(), 'hf-git-'))
  execFileSync('git', ['init', '-q', directory], { stdio: 'ignore' })
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }))
  return { ...process.env, GIT_DIR: join(directory, '.git'), GIT_WORK_TREE: root }
}

/**
 * The environment to run git with in a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns Nothing for a checkout, so git inherits the process's environment; an environment naming an empty repository otherwise
 */
export function gitEnvironment(root: string): NodeJS.ProcessEnv | undefined {
  if (!environments.has(root)) environments.set(root, inRepository(root) ? undefined : detachedEnvironment(root))
  return environments.get(root)
}
