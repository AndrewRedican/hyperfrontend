/**
 * What the executors ask of the workspace a task runs in: where one of its packages lives as
 * that workspace resolves it, where a project's build writes, and which packages are its own.
 *
 * @module executors/shared/workspace
 */

import type { ProjectConfiguration } from '../../runner/contract'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../../graph/workspace'

/** The target whose output a package is packed, tested and published from. */
export const BUILD_TARGET = 'build'

/**
 * The file a module specifier names, resolved from the workspace root the way any module of the
 * workspace resolves it: through the workspace's path aliases where the process installed them,
 * else from the workspace's `node_modules`.
 *
 * @param root - The workspace root, absolute
 * @param specifier - The module, such as `@scope/package/entry`
 * @returns The file, or null when the workspace cannot resolve the module
 */
export function resolveFromWorkspace(root: string, specifier: string): string | null {
  try {
    return createRequire(join(root, 'package.json')).resolve(specifier)
  } catch {
    return null
  }
}

/**
 * Where a project's build writes: the `outputPath` its `build` target runs with, else
 * `dist/<project root>`.
 *
 * @param root - The workspace root, absolute
 * @param project - The project's configuration, its targets resolved
 * @returns The output directory, absolute
 */
export function buildOutputOf(root: string, project: ProjectConfiguration): string {
  const configured = project.targets?.[BUILD_TARGET]?.options?.['outputPath']
  return join(root, typeof configured === 'string' ? configured : join('dist', project.root))
}

/** A manifest, as far as its name is read. */
interface NamedManifest {
  /** The package's name. */
  readonly name?: string
}

/**
 * The names of the packages the workspace's own projects carry.
 *
 * @param root - The workspace root, absolute
 * @param projects - Every project's configuration by name
 * @returns The name of each project's `package.json`, where it has one that names itself
 */
export function workspacePackages(root: string, projects: Readonly<Record<string, ProjectConfiguration>>): string[] {
  return values(projects).flatMap((project) => {
    const name = readJson<NamedManifest>(join(root, project.root, 'package.json'))?.name
    return name === undefined ? [] : [name]
  })
}
