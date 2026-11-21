/**
 * The `workspace` generator: the root files the engine reads, written into a repository that has
 * none yet.
 *
 * @module generators/workspace/generator
 */

import type { Tree } from '../../runner/contract'
import type { WorkspaceGeneratorOptions } from './options'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { DEFAULT_HOOKS, stubDirectory, writeHooksSetup, writeStubs } from '../hooks/generator'
import { formatFiles } from '../shared/format'
import { generateFiles } from '../shared/templates'
import { updateJson } from '../shared/tree'

/** The file whose presence marks a workspace root. */
const WORKSPACE_FILE = 'hf.json'

/** The root manifest the generator settles. */
const ROOT_MANIFEST = 'package.json'

/** The package of Node.js type declarations the generated TypeScript configurations name. */
const NODE_TYPES = '@types/node'

/** The script that installs the hooks of a clone. */
const INSTALL_HOOKS = 'hf generate hooks'

/** The root manifest, as far as the generator settles it. */
interface RootManifestFields {
  /** How the repository's `.js` files, and the `.ts` files Node loads, are read. */
  type?: string
  /** The scripts. */
  scripts?: Record<string, string>
  /** The development dependencies. */
  devDependencies?: Record<string, string>
}

/** What `.hfignore` lists: the files no project's inputs read. */
const HF_IGNORE = 'CHANGELOG.md\n**/CHANGELOG.md\n'

/** What `.gitignore` lists when the repository has none: the directories the engine, the builds and the test runs write. */
const GIT_IGNORE = 'node_modules\ndist\ntmp\ncoverage\n.hf\n'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/**
 * Writes the root configuration of a workspace: `hf.json` with the target defaults of the
 * packaged executors, `tsconfig.base.json` with an empty alias map, a base lint configuration
 * registering the `projects` rule family, `.hfignore`, and a `.gitignore` when there is none.
 * The root manifest, where there is one, becomes an ES module package, since the configurations
 * written are modules, and gains the Node.js type declarations the configurations name, on the
 * major of the running Node.js, for the next `npm install` to fetch. Asked for hooks, it also
 * writes a first `hooks.config.ts`, ignores the clone's local file and installs the stubs; asked
 * for the prepare script too, the root manifest installs them on every install.
 *
 * @param tree - The tree, rooted at the repository
 * @param options - Whether to set up hooks, add the prepare script, and format
 * @param env - The environment, this process's unless another is given
 * @returns Resolves when the files are written
 * @throws {Error} When the tree already holds an `hf.json`, or the prepare script is asked for without hooks or a root manifest
 *
 * @example Starting a workspace in a repository that has none
 * ```bash
 * npx hf generate workspace
 * ```
 *
 * @example From a setup script, over a tree of the repository
 * ```typescript
 * import { commitChanges, createFsTree } from '@hyperfrontend/project-scope/vfs'
 * import workspaceGenerator from '@hyperfrontend/workspace/generators/workspace'
 *
 * const tree = createFsTree(process.cwd())
 * await workspaceGenerator(tree, { skipFormat: true })
 * commitChanges(tree) // writes hf.json, tsconfig.base.json, lint.base.config.ts, .hfignore and, when missing, .gitignore; settles package.json
 * ```
 *
 * @example With Git hooks, installed again on every install of the repository
 * ```bash
 * npx hf generate workspace --hooks --prepare
 * ```
 */
export async function workspaceGenerator(
  tree: Tree,
  options: WorkspaceGeneratorOptions = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<void> {
  if (tree.exists(WORKSPACE_FILE)) throw createError(`${WORKSPACE_FILE} already exists: this is a workspace`)
  if (options.prepare === true && !(options.hooks === true && tree.exists(ROOT_MANIFEST))) {
    throw createError(
      '--prepare adds a script to the root package.json beside --hooks: pass --hooks, from a directory that has a package.json'
    )
  }
  generateFiles(tree, TEMPLATES, '.', {})
  tree.write('.hfignore', HF_IGNORE)
  if (!tree.exists('.gitignore')) tree.write('.gitignore', GIT_IGNORE)
  if (tree.exists(ROOT_MANIFEST)) settleRootManifest(tree)
  if (options.hooks === true) writeHooks(tree, options.prepare === true, env)
  if (!options.skipFormat) await formatFiles(tree)
}

/**
 * Writes the first hooks configuration, installs its stubs where the clone can take them, and on
 * request has the root manifest install them on every install.
 *
 * @param tree - The tree, rooted at the repository
 * @param prepare - Whether the root manifest gains the prepare script
 * @param env - The environment
 */
function writeHooks(tree: Tree, prepare: boolean, env: Readonly<Record<string, string | undefined>>): void {
  writeHooksSetup(tree)
  const directory = stubDirectory(tree, env)
  if (directory !== null) writeStubs(tree, { directory, hooks: DEFAULT_HOOKS, force: false })
  if (!prepare) return
  updateJson<RootManifestFields>(tree, ROOT_MANIFEST, (manifest) => {
    const before = manifest.scripts?.['prepare']
    const after = before === undefined || before.includes(INSTALL_HOOKS) ? before : `${before} && ${INSTALL_HOOKS}`
    return { ...manifest, scripts: { ...manifest.scripts, prepare: after ?? INSTALL_HOOKS } }
  })
}

/**
 * Makes the root manifest an ES module package and names the Node.js type declarations among
 * its development dependencies, keeping a range it already states.
 *
 * @param tree - The tree, rooted at the repository
 */
function settleRootManifest(tree: Tree): void {
  // why: npm init writes "type": "commonjs", under which Node refuses the import statements of the lint configurations the generators write
  updateJson<RootManifestFields>(tree, ROOT_MANIFEST, (manifest) => ({
    ...manifest,
    type: 'module',
    devDependencies: { [NODE_TYPES]: `^${process.versions.node.split('.')[0]}.0.0`, ...manifest.devDependencies },
  }))
}

export default workspaceGenerator
