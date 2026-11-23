/**
 * The `application` generator: a project of the workspace that is run, not imported, with its
 * project, manifest, TypeScript, lint and test configuration, an entry module and its spec.
 *
 * @module generators/application/generator
 */

import type { Tree } from '../../runner/contract'
import type { ApplicationGeneratorOptions } from './options'
import { join } from 'node:path'
import { formatFiles } from '../shared/format'
import { planRunnableProject, writeRunnableProject } from '../shared/runnable-project'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/**
 * Creates an application: a `project.json` that states `projectType: 'application'` with the
 * `typecheck` and `test` targets, a private ES module `package.json`, the TypeScript, lint and
 * test configurations, and `src/main.ts` with a spec that passes on it, so the new project's
 * type check, lint and tests succeed as written. No alias is added to `tsconfig.base.json`,
 * since no project may import an application.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - What to create
 * @returns Resolves when the application is written
 * @throws {Error} When the directory already exists, a project already has the name, or the project name cannot be written
 *
 * @example An application under the default directory
 * ```bash
 * npx hf generate application web --tags=type:app
 * npx hf run web:test
 * ```
 *
 * @example Under a chosen directory, with the name tasks address it by
 * ```bash
 * npx hf generate application admin --directory=apps/internal --projectName=app-admin
 * ```
 *
 * @example From a workspace's own generator, formatting once at the end
 * ```typescript
 * import applicationGenerator from '@hyperfrontend/workspace/generators/application'
 * import { formatFiles } from '@hyperfrontend/workspace/generators'
 *
 * await applicationGenerator(tree, { name: 'web', tags: ['type:app'], skipFormat: true })
 * tree.write('apps/web/src/routes.ts', 'export const routes = ["/"]\n')
 * await formatFiles(tree)
 * ```
 */
export async function applicationGenerator(tree: Tree, options: ApplicationGeneratorOptions): Promise<void> {
  writeRunnableProject(tree, TEMPLATES, planRunnableProject(tree, options, 'application'), { typecheck: {}, test: {} })
  if (!options.skipFormat) await formatFiles(tree)
}

export default applicationGenerator
