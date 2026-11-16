/**
 * The packages the workspace's own projects carry, as the build tells first-party code from
 * dependencies: a first-party package is bundled where a format asks for it and left out of the
 * published dependencies, so this list shapes what a build emits.
 *
 * @module executors/build/workspace-packages
 */

import type { ProjectConfiguration } from '../../runner/contract'
import { join } from 'node:path'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../../graph/json'

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
 *
 * @example The first-party packages a build bundles rather than lists as dependencies
 * ```typescript
 * workspacePackages(context.root, context.projects)
 * // => ['@acme/core', '@acme/utils', '@acme/e2e-core']; a project without a package.json contributes nothing
 * ```
 */
export function workspacePackages(root: string, projects: Readonly<Record<string, ProjectConfiguration>>): string[] {
  return values(projects).flatMap((project) => {
    const name = readJson<NamedManifest>(join(root, project.root, 'package.json'))?.name
    return name === undefined ? [] : [name]
  })
}
