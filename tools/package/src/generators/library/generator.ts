/**
 * This repository's `library` generator: the packaged one with this repository's conventions,
 * the stricter lint template, and the local `make-publishable` for a publishable library.
 *
 * @module generators/library/generator
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import type { LibraryGeneratorSchema } from './schema'
import { join } from 'node:path'
import { formatFiles, generateFiles, updateJson } from '@hyperfrontend/workspace/generators'
import { libraryGenerator as createLibrary, planLibrary } from '@hyperfrontend/workspace/generators/library'
import { PACKAGE_SCOPE, derivePackageName, deriveProjectNameFromPath } from '../../lib/naming-utils'
import { makePublishableGenerator } from '../make-publishable/generator'

/** A project.json as far as its targets go. */
interface ProjectTargets {
  /** The targets, by name */
  targets?: Record<string, unknown>
}

/** The generator's templates, relative to the workspace root. */
const TEMPLATES = 'tools/package/src/generators/library/files'

/**
 * Creates a library of this repository: the packaged generator with the `@hyperfrontend` scope,
 * the `lib-<name>` project name and the `type:`/`scope:` tags, then the lint configuration that
 * turns on the workspace rules, then the local `make-publishable` when asked.
 *
 * @param tree - The virtual file system tree
 * @param options - Configuration options for the library
 * @returns A promise that resolves when the generator completes
 * @throws {Error} When publishable is true and no compatibility profile was given.
 *
 * @example Create an internal utility library
 * ```bash
 * npx hf generate library --name=my-lib --type=util
 * ```
 *
 * @example Create a publishable library
 * ```bash
 * npx hf generate library --name=my-lib --type=util --publishable --compatibility=isomorphic
 * ```
 *
 * @example Create a nested library under utils
 * ```bash
 * npx hf generate library --name=my-utils --directory=libs/utils
 * ```
 */
export async function libraryGenerator(tree: Tree, options: LibraryGeneratorSchema): Promise<void> {
  const plan = planLibrary(tree, { name: options.name, directory: options.directory })
  const projectName = deriveProjectNameFromPath(plan.projectRoot)
  await createLibrary(tree, {
    name: options.name,
    directory: options.directory,
    scope: PACKAGE_SCOPE,
    projectName,
    packageName: derivePackageName(projectName),
    description: options.description,
    tags: [`type:${options.type ?? 'util'}`, 'scope:internal'],
    skipFormat: true,
  })
  generateFiles(tree, join(tree.root, TEMPLATES), plan.projectRoot, { offsetFromRoot: plan.offsetFromRoot })
  // why: an internal library of this repository is never built; make-publishable adds the build target with the formats when the library is published
  updateJson<ProjectTargets>(tree, join(plan.projectRoot, 'project.json'), (json) => {
    delete json.targets?.['build']
    return json
  })
  if (options.publishable === true) {
    await makePublishableGenerator(tree, {
      project: projectName,
      keywords: options.keywords,
      compatibility: options.compatibility,
      docsCategory: options.docsCategory,
      ecosystemTier: options.ecosystemTier,
      skipFormat: true,
    })
  }
  if (!options.skipFormat) await formatFiles(tree)
}

export default libraryGenerator
