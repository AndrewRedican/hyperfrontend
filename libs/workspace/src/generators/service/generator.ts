/**
 * The `service` generator: a project of the workspace that is built, run and deployed as a
 * service on `@hyperfrontend/server`, with its project, manifest, TypeScript, lint and test
 * configuration, a configuration file of its own, the service, its spec and the main that runs it.
 *
 * @module generators/service/generator
 */

import type { TargetConfiguration, Tree } from '../../runner/contract'
import type { PathsTsConfig } from '../shared/tsconfig-paths'
import type { ServiceGeneratorOptions } from './options'
import { join, posix, win32 } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { format, lt, parseVersion, parseVersionStrict } from '@hyperfrontend/versioning/semver'
import { formatFiles } from '../shared/format'
import { joinPathFragments } from '../shared/paths'
import { planRunnableProject, writeRunnableProject } from '../shared/runnable-project'
import { readJson, updateJson } from '../shared/tree'
import { BASE_TSCONFIG } from '../shared/tsconfig-paths'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/** The package a service is written on. */
const KERNEL = '@hyperfrontend/server'

/** The first release of the kernel that has the runner a service is written on. */
const KERNEL_FLOOR = parseVersionStrict('0.2.0')

/** Where an installed kernel states its version. */
const INSTALLED_KERNEL = `node_modules/${KERNEL}/package.json`

/** The targets of a service: the build and the run from source are stated whole, the type check and the tests take the workspace's defaults. */
const TARGETS: Readonly<Record<string, TargetConfiguration>> = {
  // why: the executor is stated in the project, so the target does not hang on a default of the workspace's own configuration
  build: { executor: '@hyperfrontend/workspace:service' },
  // why: the root is quoted, so a directory with a space or a bracket in its name is one argument to the shell the command runs in
  dev: { command: 'node --import @hyperfrontend/workspace/hooks "{projectRoot}/src/main.ts"' },
  typecheck: {},
  test: {},
}

/** A manifest as far as its name, its version and its dependencies go. */
interface ServiceManifest {
  /** The name the package states */
  name?: string
  /** The version the package states */
  version?: string
  /** The packages it runs on, by name */
  dependencies?: Record<string, string>
}

/**
 * The manifests a project behind the workspace's alias for the kernel could state its version
 * in: one per directory above the module the alias names, the nearest first, the workspace's
 * own left out.
 *
 * @param tree - The tree whose base tsconfig is read
 * @returns The paths, none where the workspace has no base tsconfig, no alias for the kernel, or an alias that names a module outside the workspace
 */
function aliasedManifests(tree: Tree): string[] {
  if (!tree.exists(BASE_TSCONFIG)) return []
  const alias = readJson<PathsTsConfig>(tree, BASE_TSCONFIG).compilerOptions?.paths?.[KERNEL]?.[0] ?? ''
  const segments = posix.normalize(alias).split(posix.sep)
  // why: a module outside the workspace has no project of the workspace behind it, and the tree reads nothing out there
  if (win32.isAbsolute(alias) || segments[0] === '..') return []
  return segments
    .slice(1)
    .map((_segment, index) => posix.join(...segments.slice(0, index + 1), 'package.json'))
    .reverse()
}

/**
 * The version of the kernel the workspace provides: of the project behind its alias for the
 * package when there is one, else of the package installed at its root.
 *
 * @param tree - The tree the manifests are read from
 * @returns The version, as a new service depends on it
 * @throws {Error} When the workspace provides no kernel, or one older than the runner a service is written on
 */
function kernelVersion(tree: Tree): string {
  // why: a manifest above the aliased module that names another package, such as one a directory of libraries shares, is not the kernel's
  const aliased = aliasedManifests(tree).find((path) => tree.exists(path) && readJson<ServiceManifest>(tree, path).name === KERNEL)
  const manifest = aliased ?? (tree.exists(INSTALLED_KERNEL) ? INSTALLED_KERNEL : undefined)
  const version = parseVersion((manifest === undefined ? undefined : readJson<ServiceManifest>(tree, manifest).version) ?? '').version
  if (version === undefined || lt(version, KERNEL_FLOOR)) {
    const needed = `a service is written on ${KERNEL} ${format(KERNEL_FLOOR)} or later`
    // why: installing the package changes nothing while the workspace's alias names a project of its own
    throw createError(
      aliased === undefined
        ? `${needed}, which this workspace does not provide: npm install ${KERNEL}`
        : `${needed}, and ${aliased}, which the workspace's alias for it names, states an earlier version or none`
    )
  }
  return format(version)
}

/**
 * Creates a service on `@hyperfrontend/server`: a `project.json` that states
 * `projectType: 'service'` with the `build`, `dev`, `typecheck` and `test` targets, a private ES
 * module `package.json` that depends on the kernel at the version the workspace provides, the
 * TypeScript, lint and test configurations, a `service.config.ts` with an empty immutable
 * section, `src/service.ts` with a spec that drives it whole, and `src/main.ts`, which runs it,
 * so the new project's type check, lint and tests succeed as written. No alias is added to
 * `tsconfig.base.json`, since no project may import a service.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - What to create
 * @returns Resolves when the service is written
 * @throws {Error} When the workspace provides no `@hyperfrontend/server` of 0.2.0 or later, `tsconfig.base.json` is not strict JSON, the directory already exists, a project already has the name, or the project name cannot be written
 *
 * @example A service under the default directory, tested, run from source and built
 * ```bash
 * npx hf generate service api --tags=type:service
 * npx hf run api:test
 * npx hf run api:dev
 * npx hf run api:build
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
 *   metadata: { deploy: { provider: 'railway', service: 'api', kind: 'service' } },
 * }))
 * await formatFiles(tree)
 * ```
 */
export async function serviceGenerator(tree: Tree, options: ServiceGeneratorOptions): Promise<void> {
  const plan = planRunnableProject(tree, options, 'service')
  // why: the version is settled before the first write, so a workspace without the kernel is refused with nothing written
  const kernel = kernelVersion(tree)
  writeRunnableProject(tree, TEMPLATES, plan, TARGETS)
  updateJson<ServiceManifest>(tree, joinPathFragments(plan.projectRoot, 'package.json'), (manifest) => ({
    ...manifest,
    dependencies: { [KERNEL]: kernel },
  }))
  if (!options.skipFormat) await formatFiles(tree)
}

export default serviceGenerator
