/**
 * What the `application` and `service` generators share: the names and the directory a project
 * that is run, not imported, settles to, and the manifests and templates it is written from.
 *
 * @module generators/shared/runnable-project
 */

import type { TargetConfiguration } from '../../runner/contract'
import type { Tree } from './tree'
import { assertWritableName, names } from './names'
import { readRootManifest } from './package-json'
import { joinPathFragments, offsetFromRoot } from './paths'
import { assertNewProject } from './projects'
import { scopeOf, scopedName } from './scope'
import { commentText, generateFiles } from './templates'
import { writeJson } from './tree'

/** The kinds of project that are run, as `project.json` names them. */
export type RunnableKind = 'application' | 'service'

/** The directory a runnable project is created under when none is given. */
const DEFAULT_DIRECTORY = 'apps'

/** What the generator of a runnable project is asked for. */
export interface RunnableProjectOptions {
  /** The name, which names the directory and, with the scope of the root manifest, the package */
  name: string
  /** The directory the project is created under; `apps` when unset */
  directory?: string
  /** The project's name, as tasks address it; the name when unset */
  projectName?: string
  /** A description of the project */
  description?: string
  /** The tags the module boundaries read */
  tags?: string[]
}

/** The options settled. */
export interface RunnableProjectPlan {
  /** What `project.json` states the project is */
  kind: RunnableKind
  /** The name, as a file name */
  name: string
  /** The project's name */
  projectName: string
  /** The name of the private package */
  packageName: string
  /** The project's directory, relative to the root */
  projectRoot: string
  /** The description */
  description: string
  /** The tags */
  tags: string[]
  /** The path from the project to the root */
  offsetFromRoot: string
}

/**
 * Settles the options of a runnable project: the names, the directory and the description.
 *
 * @param tree - The tree, whose root manifest gives the scope of the package
 * @param options - The options as given
 * @param kind - Whether an application or a service is planned
 * @returns The names, the root and the description the project is written from
 * @throws {Error} When the project name holds what the strings and comments it is written into could not carry
 *
 * @example The names a spelling and the root manifest's scope settle to
 * ```typescript
 * planRunnableProject(tree, { name: 'AdminPortal' }, 'application')
 * // => {
 * //   kind: 'application',
 * //   name: 'admin-portal',
 * //   projectName: 'admin-portal',
 * //   packageName: '@acme/admin-portal',
 * //   projectRoot: 'apps/admin-portal',
 * //   description: 'AdminPortal application.',
 * //   tags: [],
 * //   offsetFromRoot: '../../',
 * // } when the root package.json is named @acme/workspace
 * ```
 */
export function planRunnableProject(tree: Tree, options: RunnableProjectOptions, kind: RunnableKind): RunnableProjectPlan {
  const name = names(options.name).fileName
  const projectRoot = joinPathFragments(options.directory ?? DEFAULT_DIRECTORY, name)
  const projectName = options.projectName ?? name
  assertWritableName('project name', projectName)
  return {
    kind,
    name,
    projectName,
    packageName: scopedName(scopeOf(readRootManifest(tree).name ?? ''), name),
    projectRoot,
    description: options.description ?? `${names(name).className} ${kind}.`,
    tags: options.tags ?? [],
    offsetFromRoot: offsetFromRoot(projectRoot),
  }
}

/**
 * Writes a runnable project: the files of its templates, a private ES module `package.json`, and
 * a `project.json` that states its kind and carries the targets it is given, in the order they
 * are given. It adds no alias, since nothing imports a project that is run. It writes nothing
 * where the project's directory is already there or another project holds its name.
 *
 * @param tree - The tree written to
 * @param templates - The template directory, absolute
 * @param plan - The settled options
 * @param targets - The targets of the project, by name; an empty target takes everything from the workspace's defaults
 * @throws {Error} When the directory already exists, or a project already has the name
 *
 * @example A service written from a generator's own templates, with the two targets the workspace's defaults configure
 * ```typescript
 * import { join } from 'node:path'
 *
 * writeRunnableProject(tree, join(import.meta.dirname, 'files'), planRunnableProject(tree, { name: 'api' }, 'service'), { typecheck: {}, test: {} })
 * readJson(tree, 'apps/api/project.json')
 * // => { name: 'api', description: 'Api service.', sourceRoot: '{projectRoot}/src', projectType: 'service', tags: [], targets: { typecheck: {}, test: {} } }
 * ```
 */
export function writeRunnableProject(
  tree: Tree,
  templates: string,
  plan: RunnableProjectPlan,
  targets: Readonly<Record<string, TargetConfiguration>>
): void {
  assertNewProject(tree, plan.projectRoot, plan.projectName)
  generateFiles(tree, templates, plan.projectRoot, { ...plan, comment: { description: commentText(plan.description) } })
  writeJson(tree, joinPathFragments(plan.projectRoot, 'package.json'), {
    name: plan.packageName,
    version: '0.0.0',
    description: plan.description,
    // why: the configurations beside the sources are ES modules, and Node reads how to load them from the nearest manifest
    type: 'module',
    private: true,
  })
  writeJson(tree, joinPathFragments(plan.projectRoot, 'project.json'), {
    name: plan.projectName,
    description: plan.description,
    sourceRoot: '{projectRoot}/src',
    // why: the kind is always stated, so the project is read the same under any directory
    projectType: plan.kind,
    tags: plan.tags,
    targets,
  })
}
