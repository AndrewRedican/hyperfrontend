/**
 * The `service` generator: a project of the workspace that is run and deployed as a service,
 * with its project, manifest, TypeScript, lint and test configuration, a configuration file of
 * its own, an entry module and its spec.
 *
 * @module generators/service/generator
 */

import type { Tree } from '../../runner/contract'
import type { ServiceGeneratorOptions } from './options'
import { join } from 'node:path'
import { formatFiles } from '../shared/format'
import { planRunnableProject, writeRunnableProject } from '../shared/runnable-project'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/**
 * Creates a service: a `project.json` that states `projectType: 'service'` with the `typecheck`
 * and `test` targets, a private ES module `package.json`, the TypeScript, lint and test
 * configurations, a `service.config.ts` the type check covers, and `src/main.ts` with a spec
 * that passes on it, so the new project's type check, lint and tests succeed as written. No
 * alias is added to `tsconfig.base.json`, since no project may import a service.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - What to create
 * @returns Resolves when the service is written
 * @throws {Error} When the directory already exists, a project already has the name, or the project name cannot be written
 *
 * @example A service under the default directory
 * ```bash
 * npx hf generate service api --tags=type:service
 * npx hf run api:test
 * ```
 *
 * @example Under a directory of its own, with the name tasks address it by
 * ```bash
 * npx hf generate service jobs --directory=services --projectName=service-jobs
 * ```
 *
 * @example From a workspace's own generator, formatting once at the end
 * ```typescript
 * import serviceGenerator from '@hyperfrontend/workspace/generators/service'
 * import { formatFiles, updateJson } from '@hyperfrontend/workspace/generators'
 *
 * await serviceGenerator(tree, { name: 'api', skipFormat: true })
 * updateJson<{ metadata?: object }>(tree, 'apps/api/project.json', (project) => ({
 *   ...project,
 *   metadata: { deploy: { provider: 'railway', service: 'api' } },
 * }))
 * await formatFiles(tree)
 * ```
 */
export async function serviceGenerator(tree: Tree, options: ServiceGeneratorOptions): Promise<void> {
  writeRunnableProject(tree, TEMPLATES, planRunnableProject(tree, options, 'service'))
  if (!options.skipFormat) await formatFiles(tree)
}

export default serviceGenerator
