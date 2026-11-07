/**
 * Which branch a batch's base revision stands for, so a batch run on that branch itself can
 * stand down: the releases of the base branch are made from the branches merged into it.
 *
 * @module executors/version-batch/lib/base-branch
 */

import { execFileSync } from 'node:child_process'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * The branch names a base revision may be read as: the revision as written, without a
 * `refs/heads/` or `refs/remotes/` prefix, and the branch behind a remote-tracking name such as
 * `origin/main` for each remote the repository knows.
 *
 * @param base - The base revision, as the batch was given it
 * @param remotes - The names of the repository's remotes
 * @returns The branch names, each once
 *
 * @example The branch behind a remote-tracking base
 * ```typescript
 * baseBranches('origin/main', ['origin']) // ['origin/main', 'main']
 * ```
 */
export function baseBranches(base: string, remotes: readonly string[]): string[] {
  const plain = base.startsWith('refs/heads/')
    ? base.slice('refs/heads/'.length)
    : base.startsWith('refs/remotes/')
      ? base.slice('refs/remotes/'.length)
      : base
  const names = createSet([base, plain])
  for (const remote of remotes) {
    if (plain.startsWith(`${remote}/`)) names.add(plain.slice(remote.length + 1))
  }
  return from(names)
}

/**
 * The remotes a repository knows.
 *
 * @param cwd - A directory inside the repository
 * @returns The remote names, or none when git cannot answer
 *
 * @example Feeding the remotes to the base branch reading
 * ```typescript
 * baseBranches('origin/main', listRemotes(root)) // => ['origin/main', 'main'] in a clone with an origin remote
 * listRemotes('/tmp/not-a-repository') // => []
 * ```
 */
export function listRemotes(cwd: string): string[] {
  try {
    return execFileSync('git', ['remote'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .filter((line) => line !== '')
  } catch {
    return []
  }
}
