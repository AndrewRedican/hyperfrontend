/**
 * Staging again what a step fixed: the files that were fully staged before the step ran and that
 * it changed. A file with unstaged content of its own is never among them, so nothing a
 * committer held back is added, and nothing is stashed.
 *
 * @module git-hooks/staged
 */

import { execFileSync } from 'node:child_process'

/** Runs git with arguments and, when given, standard input; answers what it printed. */
export type Git = (args: readonly string[], input?: string) => string

/** How large a listing of paths may be, in bytes. */
const LIST_BUFFER = 1 << 28

/**
 * The paths a NUL-separated listing holds.
 *
 * @param listing - What git printed under `-z`
 * @returns Each path listed, in git's order
 */
function pathsOf(listing: string): string[] {
  return listing.split('\0').filter((path) => path !== '')
}

/**
 * Git, run from a directory.
 *
 * @param cwd - The directory, absolute
 * @returns Runs git there
 *
 * @example Asking the repository of the working directory
 * ```typescript
 * import { gitIn } from '@hyperfrontend/workspace/git-hooks'
 *
 * gitIn(process.cwd())(['rev-parse', '--show-prefix']) // => '\n' at the root of a working tree
 * ```
 */
export function gitIn(cwd: string): Git {
  return (args, input) =>
    execFileSync('git', [...args], { cwd, encoding: 'utf8', input, maxBuffer: LIST_BUFFER, stdio: ['pipe', 'pipe', 'ignore'] })
}

/**
 * The files whose staged content is all there is to them: staged, and with no unstaged change.
 *
 * @param git - Runs git in the workspace
 * @returns The paths, relative to the directory git runs in
 *
 * @example Before a formatter runs
 * ```typescript
 * import { fullyStaged, gitIn } from '@hyperfrontend/workspace/git-hooks'
 *
 * fullyStaged(gitIn(process.cwd())) // => ['src/a.ts'] when src/b.ts is staged too but was edited since
 * ```
 */
export function fullyStaged(git: Git): string[] {
  const unstaged = pathsOf(git(['diff', '--relative', '--name-only', '-z']))
  return pathsOf(git(['diff', '--relative', '--name-only', '-z', '--cached', '--diff-filter=ACMR'])).filter(
    (path) => !unstaged.includes(path)
  )
}

/**
 * Stages again the files a step changed, among those that were fully staged before it.
 *
 * @param git - Runs git in the workspace
 * @param before - The files that were fully staged before the step
 * @returns The files staged again
 *
 * @example After a formatter ran
 * ```typescript
 * import { fullyStaged, gitIn, restage } from '@hyperfrontend/workspace/git-hooks'
 *
 * const git = gitIn(process.cwd())
 * const before = fullyStaged(git)
 * // ... the formatter rewrites src/a.ts
 * restage(git, before) // => ['src/a.ts'], staged with the formatter's changes
 * ```
 */
export function restage(git: Git, before: readonly string[]): string[] {
  const fixed = pathsOf(git(['diff', '--relative', '--name-only', '-z'])).filter((path) => before.includes(path))
  // why: the paths go through standard input, so a commit of any size stays under the length a command line may have
  if (fixed.length > 0) git(['--literal-pathspecs', 'add', '--pathspec-from-file=-', '--pathspec-file-nul'], fixed.join('\0'))
  return fixed
}
