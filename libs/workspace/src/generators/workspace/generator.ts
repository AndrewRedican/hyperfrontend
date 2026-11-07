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

/** The file whose presence marks a workspace root. */
const WORKSPACE_FILE = 'hf.json'

/** What `.hfignore` lists: the files no project's inputs read. */
const HF_IGNORE = 'CHANGELOG.md\n**/CHANGELOG.md\n'

/** What `.gitignore` lists when the repository has none: the directories the engine and the builds write. */
const GIT_IGNORE = 'node_modules\ndist\ntmp\n.hf\n'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/**
 * Writes the root configuration of a workspace: `hf.json` with the target defaults of the
 * packaged executors, `tsconfig.base.json` with an empty alias map, a base lint configuration
 * registering the `projects` rule family, `.hfignore`, and a `.gitignore` when there is none.
 *
 * @param tree - The tree, rooted at the repository
 * @param options - Whether to format
 * @returns Resolves when the files are written
 * @throws {Error} When the tree already holds an `hf.json`
 *
 * @example
 * ```bash
 * npx hf generate workspace
 * ```
 */
export async function workspaceGenerator(tree: Tree, options: WorkspaceGeneratorOptions = {}): Promise<void> {
  if (tree.exists(WORKSPACE_FILE)) throw createError(`${WORKSPACE_FILE} already exists: this is a workspace`)
  generateFiles(tree, TEMPLATES, '.', {})
  tree.write('.hfignore', HF_IGNORE)
  if (!tree.exists('.gitignore')) tree.write('.gitignore', GIT_IGNORE)
  if (!options.skipFormat) await formatFiles(tree)
}

export default workspaceGenerator
