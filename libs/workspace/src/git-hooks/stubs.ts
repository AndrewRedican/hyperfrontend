/**
 * The stubs Git runs: one POSIX `sh` file per configured hook that starts this command line's
 * `hooks run`. A stub is recognised by its marker, so installing again rewrites the package's own
 * stubs, takes the place of Lefthook's, removes those of hooks no longer configured, and leaves a
 * stub somebody else wrote alone.
 *
 * @module git-hooks/stubs
 */

import type { GitHook } from './config'
import type { Git } from './staged'
import { isAbsolute, posix, relative, resolve, sep } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { findUpwardWhere, readFileIfExists } from '@hyperfrontend/project-scope/core'
import { ENGINE_PACKAGE } from '../runner/generators'
import { refusal } from '../runner/refusal'

/** The comment that marks a stub as this package's own. */
export const STUB_MARKER = '# hf-hooks:'

/** Who wrote a stub. */
export const StubOrigin = freeze({
  /** This package. */
  Own: 'own',
  /** Lefthook, whose stubs call a tool a ported repository no longer installs. */
  Lefthook: 'lefthook',
  /** Anybody else. */
  Foreign: 'foreign',
} as const)

/** One of the origins. */
export type StubOrigin = (typeof StubOrigin)[keyof typeof StubOrigin]

/** What installing does to the hooks directory. */
export interface StubPlan {
  /** The hooks whose stub is written. */
  readonly write: readonly GitHook[]
  /** The files removed: this package's and Lefthook's stubs of hooks no longer configured. */
  readonly remove: readonly string[]
  /** The configured hooks whose file somebody else wrote. */
  readonly foreign: readonly GitHook[]
}

/** Where stubs go, or why none is written. */
export interface StubPlace {
  /** The hooks directory, workspace-relative and POSIX; null when no stub is written. */
  readonly directory: string | null
  /** Why no stub is written, when that is worth saying; null where staying quiet is the point. */
  readonly reason: string | null
}

/** A package manifest, as far as locating the command line reads it. */
interface Manifest {
  /** The package's name. */
  readonly name?: string
  /** Its executables. */
  readonly bin?: Readonly<Record<string, string>>
}

/** The values of `CI` that mean it is not set. */
const UNSET = ['', '0', 'false']

/**
 * A path with POSIX separators, as a stub and a tree write it.
 *
 * @param path - A path of this platform
 * @returns The path with `/` between its segments
 */
function posixPath(path: string): string {
  return path.split(sep).join(posix.sep)
}

/**
 * The stub of a hook.
 *
 * @param hook - Which hook the stub starts
 * @param entry - The command line's entry module, relative to the workspace root or absolute, POSIX
 * @returns The file's content
 *
 * @example The stub Git runs before a commit
 * ```typescript
 * import { stubOf } from '@hyperfrontend/workspace/git-hooks'
 *
 * stubOf('pre-commit', 'node_modules/@hyperfrontend/workspace/bin/hf.mjs')
 * // => '#!/bin/sh\n# hf-hooks: ...\nexec node "node_modules/@hyperfrontend/workspace/bin/hf.mjs" hooks run pre-commit "$@"\n'
 * ```
 */
export function stubOf(hook: GitHook, entry: string): string {
  return [
    '#!/bin/sh',
    `${STUB_MARKER} written by hf generate hooks and rewritten by its next run; the steps are in hooks.config.ts`,
    `exec node "${entry.replace(/["$`\\]/g, '\\$&')}" hooks run ${hook} "$@"`,
    '',
  ].join('\n')
}

/**
 * Who wrote a stub.
 *
 * @param content - The file's content
 * @returns This package, Lefthook, or somebody else
 *
 * @example Telling a stub that may be replaced from one that may not
 * ```typescript
 * import { stubOf, stubOrigin } from '@hyperfrontend/workspace/git-hooks'
 *
 * stubOrigin(stubOf('pre-push', 'node_modules/@hyperfrontend/workspace/bin/hf.mjs')) // => 'own'
 * stubOrigin('#!/bin/sh\ncall_lefthook run "pre-push" "$@"\n') // => 'lefthook'
 * stubOrigin('#!/bin/sh\ngit lfs pre-push "$@"\n') // => 'foreign'
 * ```
 */
export function stubOrigin(content: string): StubOrigin {
  if (content.includes(`\n${STUB_MARKER}`)) return StubOrigin.Own
  return content.includes('lefthook') ? StubOrigin.Lefthook : StubOrigin.Foreign
}

/**
 * What installing the stubs of the configured hooks does to a hooks directory.
 *
 * @param existing - The content of each file in the directory, by name
 * @param configured - The hooks that have steps
 * @returns The stubs to write, the files to remove, and the configured hooks somebody else's file occupies
 *
 * @example A clone that Lefthook set up, with a hook of the committer's own
 * ```typescript
 * import { planStubs } from '@hyperfrontend/workspace/git-hooks'
 *
 * planStubs(
 *   new Map([
 *     ['pre-commit', '#!/bin/sh\ncall_lefthook run "pre-commit" "$@"\n'],
 *     ['post-commit', '#!/bin/sh\ncall_lefthook run "post-commit" "$@"\n'],
 *     ['pre-push', '#!/bin/sh\ngit lfs pre-push "$@"\n'],
 *   ]),
 *   ['pre-commit', 'pre-push']
 * )
 * // => { write: ['pre-commit'], remove: ['post-commit'], foreign: ['pre-push'] }
 * ```
 */
export function planStubs(existing: ReadonlyMap<string, string>, configured: readonly GitHook[]): StubPlan {
  const foreign = configured.filter((hook) => existing.has(hook) && stubOrigin(existing.get(hook) as string) === StubOrigin.Foreign)
  return {
    write: configured.filter((hook) => !foreign.includes(hook)),
    remove: [...existing]
      .filter(([name, content]) => !(configured as readonly string[]).includes(name) && stubOrigin(content) !== StubOrigin.Foreign)
      .map(([name]) => name),
    foreign,
  }
}

/**
 * Where the stubs of a workspace go. None is written under `CI` or outside a repository, quietly,
 * because the installing command also runs from the `prepare` script of deploy builds; none is
 * written, with the reason, where the workspace is not the root of its repository or Git reads
 * the repository's hooks from a directory outside the workspace.
 *
 * @param root - The workspace root, absolute
 * @param env - The environment
 * @param git - Runs git in the workspace
 * @returns The hooks directory, or why there is none to write to
 *
 * @example A clone, and a deploy build of the same repository
 * ```typescript
 * import { gitIn, stubPlace } from '@hyperfrontend/workspace/git-hooks'
 *
 * stubPlace(process.cwd(), {}, gitIn(process.cwd())) // => { directory: '.git/hooks', reason: null }
 * stubPlace(process.cwd(), { CI: 'true' }, gitIn(process.cwd())) // => { directory: null, reason: null }
 * ```
 */
export function stubPlace(root: string, env: Readonly<Record<string, string | undefined>>, git: Git): StubPlace {
  if (!UNSET.includes(env['CI'] ?? '')) return { directory: null, reason: null }
  let answered: string
  try {
    answered = git(['rev-parse', '--show-prefix', '--git-path', 'hooks'])
  } catch {
    return { directory: null, reason: null }
  }
  const [prefix, hooks] = answered.split(/\r?\n/) as [string, string]
  if (prefix !== '') return { directory: null, reason: 'the workspace is not at the root of its repository' }
  const directory = relative(root, resolve(root, hooks))
  if (directory.startsWith('..') || isAbsolute(directory)) {
    return { directory: null, reason: `git reads the hooks of this repository from ${hooks}, outside the workspace` }
  }
  return { directory: posixPath(directory), reason: null }
}

/**
 * The entry module a stub starts: the `hf` executable of the package this module belongs to, as
 * a path from the workspace root where the package lies inside it.
 *
 * @param root - The workspace root, absolute
 * @param from - A directory of the package, absolute
 * @returns The entry module, workspace-relative where it can be, POSIX
 * @throws {Error} A refusal when no manifest of the package lies at or above the directory
 *
 * @example The executable of the installed package
 * ```typescript
 * import { stubEntry } from '@hyperfrontend/workspace/git-hooks'
 *
 * stubEntry('/repo', '/repo/node_modules/@hyperfrontend/workspace/git-hooks')
 * // => 'node_modules/@hyperfrontend/workspace/bin/hf.mjs'
 * ```
 */
export function stubEntry(root: string, from: string): string {
  const manifestOf = (directory: string): Manifest => parse(readFileIfExists(resolve(directory, 'package.json')) ?? '{}') as Manifest
  const home = findUpwardWhere(from, (directory) => manifestOf(directory).name === ENGINE_PACKAGE)
  const bin = home === null ? undefined : manifestOf(home).bin?.['hf']
  if (home === null || bin === undefined) throw refusal(`no ${ENGINE_PACKAGE} manifest with an hf executable at or above ${from}`)
  const entry = relative(root, resolve(home, bin))
  return posixPath(entry.startsWith('..') ? resolve(home, bin) : entry)
}
