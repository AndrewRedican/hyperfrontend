/**
 * The `hooks` generator: the stubs Git runs for the hooks a workspace configures, a first
 * configuration where the workspace has none, and the ignore line of the clone's local file.
 *
 * @module generators/hooks/generator
 */

import type { GitHook } from '../../git-hooks/config'
import type { Tree } from '../../runner/contract'
import type { HooksGeneratorOptions } from './options'
import { posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { GIT_HOOKS } from '../../git-hooks/config'
import { HOOKS_CONFIG, loadHooks, LOCAL_HOOKS_CONFIG } from '../../git-hooks/load'
import { gitIn } from '../../git-hooks/staged'
import { planStubs, stubEntry, stubOf, stubPlace } from '../../git-hooks/stubs'
import { refusal } from '../../runner/refusal'
import { formatFiles } from '../shared/format'

/** The stubs to install and where. */
export interface StubRequest {
  /** The hooks directory, relative to the tree's root, POSIX. */
  readonly directory: string
  /** The hooks that have steps. */
  readonly hooks: readonly GitHook[]
  /** Whether a file somebody else wrote is replaced. */
  readonly force: boolean
}

/** The hooks the first configuration gives steps. */
export const DEFAULT_HOOKS: readonly GitHook[] = ['pre-commit', 'pre-push']

/** The configuration a workspace that has none starts from. */
const DEFAULT_CONFIG = `import { defineHooks } from '@hyperfrontend/workspace/git-hooks'

/**
 * The Git hooks of this workspace: per hook, named steps that run in order, the first failure
 * ending the hook. \`npx hf generate hooks\` installs them into a clone, and \`npx hf hooks run
 * pre-push\` rehearses a push without pushing. A clone leaves steps out in an untracked
 * ${LOCAL_HOOKS_CONFIG}: \`export default defineLocalHooks({ skip: ['checks'] })\`.
 */
export default defineHooks({
  'pre-commit': [{ name: 'format', run: ['hf', 'format', '--write'], stageFixed: true }],
  'pre-push': [
    {
      name: 'checks',
      run: ['hf', 'affected', '-t', 'typecheck,lint', '-t', 'test'],
      failText: 'A check failed. Each task wrote its log under .hf/logs.',
    },
  ],
})
`

/** The file listing what the repository does not track. */
const GIT_IGNORE = '.gitignore'

/** The permissions of a stub: Git runs only a hook it may execute. */
const EXECUTABLE = 0o755

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const HERE = typeof __dirname === 'string' ? __dirname : import.meta.dirname

/**
 * Writes what a workspace's hooks start from: the first configuration, unless the workspace has
 * one, and the line that keeps a clone's local file out of the repository.
 *
 * @param tree - The tree, rooted at the workspace
 *
 * @example Giving a workspace of your own generator its hooks
 * ```typescript
 * import { writeHooksSetup } from '@hyperfrontend/workspace/generators/hooks'
 *
 * writeHooksSetup(tree) // writes hooks.config.ts when missing, and adds hooks.local.config.ts to .gitignore
 * ```
 */
export function writeHooksSetup(tree: Tree): void {
  if (!tree.exists(HOOKS_CONFIG)) tree.write(HOOKS_CONFIG, DEFAULT_CONFIG)
  const ignored = tree.read(GIT_IGNORE, 'utf-8') ?? ''
  if (ignored.split(/\r?\n/).includes(LOCAL_HOOKS_CONFIG)) return
  tree.write(GIT_IGNORE, `${ignored}${ignored === '' || ignored.endsWith('\n') ? '' : '\n'}${LOCAL_HOOKS_CONFIG}\n`)
}

/**
 * Writes the stub of every configured hook into a hooks directory, removes this package's and
 * Lefthook's stubs of hooks no longer configured, and leaves every other file alone.
 *
 * @param tree - The tree, rooted at the workspace
 * @param request - The directory, the hooks and whether to replace a foreign file
 * @throws {Error} A refusal naming the hook files somebody else wrote, unless asked to replace them
 *
 * @example Installing two hooks into the repository of the tree
 * ```typescript
 * import { writeStubs } from '@hyperfrontend/workspace/generators/hooks'
 *
 * writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit', 'pre-push'], force: false })
 * ```
 */
export function writeStubs(tree: Tree, request: StubRequest): void {
  const { directory } = request
  const existing = createMap<string, string>()
  for (const name of tree.exists(directory) ? tree.children(directory) : []) {
    const path = posix.join(directory, name)
    if (tree.isFile(path)) existing.set(name, tree.read(path, 'utf-8') as string)
  }
  const plan = planStubs(existing, request.hooks)
  if (plan.foreign.length > 0 && !request.force) {
    const files = plan.foreign.map((hook) => posix.join(directory, hook)).join(', ')
    throw refusal(`${files} was not written by hf generate hooks: move it aside, or pass --force to replace it`)
  }
  const entry = stubEntry(tree.root, HERE)
  for (const name of plan.remove) tree.delete(posix.join(directory, name))
  for (const hook of [...plan.write, ...plan.foreign]) {
    tree.write(posix.join(directory, hook), stubOf(hook, entry), { permissions: EXECUTABLE })
  }
}

/**
 * The hooks directory the stubs of a tree's workspace go to, saying why when there is one reason
 * worth saying and no directory.
 *
 * @param tree - The tree, rooted at the workspace
 * @param env - The environment
 * @returns The directory, relative to the tree's root, or null when no stub is to be written
 *
 * @example Writing stubs only where a clone can take them
 * ```typescript
 * import { DEFAULT_HOOKS, stubDirectory, writeStubs } from '@hyperfrontend/workspace/generators/hooks'
 *
 * const directory = stubDirectory(tree, process.env) // => '.git/hooks' in a clone, null in a deploy build
 * if (directory !== null) writeStubs(tree, { directory, hooks: DEFAULT_HOOKS, force: false })
 * ```
 */
export function stubDirectory(tree: Tree, env: Readonly<Record<string, string | undefined>>): string | null {
  const place = stubPlace(tree.root, env, gitIn(tree.root))
  // why: the shared logger prints errors alone unless a task raises its level, and this is not an error
  if (place.reason !== null) process.stderr.write(`hf generate hooks: no hook installed: ${place.reason}\n`)
  return place.directory
}

/**
 * Installs the hooks of the workspace into the clone: a POSIX `sh` stub per configured hook in
 * the repository's hooks directory, each starting `hf hooks run <hook>`. A workspace without a
 * `hooks.config.ts` gets a first one. It writes nothing and succeeds where `CI` is set or there
 * is no repository, so a root `prepare` script may run it in every install; it says why and
 * writes nothing where the workspace is not the root of its repository or Git reads the hooks
 * from a directory outside it.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - Whether to replace a foreign hook file, and whether to format
 * @param env - The environment, this process's unless another is given
 * @returns Resolves when the stubs are written
 * @throws {Error} A refusal naming the hook files somebody else wrote, unless asked to replace them
 *
 * @example Installing the hooks of a clone
 * ```bash
 * npx hf generate hooks
 * ```
 *
 * @example On every install of the repository, from its root manifest
 * ```json
 * { "scripts": { "prepare": "hf generate hooks" } }
 * ```
 */
export async function hooksGenerator(
  tree: Tree,
  options: HooksGeneratorOptions = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<void> {
  const directory = stubDirectory(tree, env)
  if (directory === null) return
  const fresh = !tree.exists(HOOKS_CONFIG)
  writeHooksSetup(tree)
  const config = fresh ? null : (await loadHooks(tree.root)).config
  writeStubs(tree, {
    directory,
    hooks: config === null ? DEFAULT_HOOKS : GIT_HOOKS.filter((hook) => (config[hook] ?? []).length > 0),
    force: options.force === true,
  })
  if (fresh && options.skipFormat !== true) await formatFiles(tree)
}

export default hooksGenerator
