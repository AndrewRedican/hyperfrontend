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
import { formatFiles } from '../shared/format'
import { generateFiles } from '../shared/templates'
import { updateJson } from '../shared/tree'

/** The file whose presence marks a workspace root. */
const WORKSPACE_FILE = 'hf.json'

/** The root manifest the generator settles. */
const ROOT_MANIFEST = 'package.json'

/** The package of Node.js type declarations the generated TypeScript configurations name. */
const NODE_TYPES = '@types/node'

/** The root manifest, as far as the generator settles it. */
interface RootManifestFields {
  /** How the repository's `.js` files, and the `.ts` files Node loads, are read. */
  type?: string
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
 * major of the running Node.js, for the next `npm install` to fetch.
 *
 * @param tree - The tree, rooted at the repository
 * @param options - Whether to format
 * @returns Resolves when the files are written
 * @throws {Error} When the tree already holds an `hf.json`
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
 */
export async function workspaceGenerator(tree: Tree, options: WorkspaceGeneratorOptions = {}): Promise<void> {
  if (tree.exists(WORKSPACE_FILE)) throw createError(`${WORKSPACE_FILE} already exists: this is a workspace`)
  generateFiles(tree, TEMPLATES, '.', {})
  tree.write('.hfignore', HF_IGNORE)
  if (!tree.exists('.gitignore')) tree.write('.gitignore', GIT_IGNORE)
  if (tree.exists(ROOT_MANIFEST)) settleRootManifest(tree)
  if (!options.skipFormat) await formatFiles(tree)
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
