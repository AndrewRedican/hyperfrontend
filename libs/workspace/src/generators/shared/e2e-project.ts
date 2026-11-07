/**
 * The project that tests a library's package: found by what it depends on, and brought along
 * when the library is renamed.
 *
 * @module generators/shared/e2e-project
 */

import type { NamedJson } from './json-updaters'
import type { ProjectConfiguration } from './projects'
import type { Tree } from './tree'
import { tarballStem } from '../../executors/version/lib/update-e2e-dependencies'
import { replaceDescriptionPackageName } from './json-updaters'
import { joinPathFragments } from './paths'
import { getProjects } from './projects'
import { unscopedName } from './scope'
import { updateJson } from './tree'

/** The target an e2e project runs. */
export const E2E_TARGET = 'e2e'

/** The prefix an e2e project's name and its package's name carry before the name of what they test. */
export const E2E_PREFIX = 'e2e-'

/** An e2e package manifest as far as a rename rewrites it. */
interface E2ePackageManifest extends NamedJson {
  /** The packed library it installs */
  dependencies?: Record<string, string>
}

/** How the library an e2e project tests was renamed. */
export interface E2eRename {
  /** The library's current project name */
  currentProjectName: string
  /** The library's new project name */
  newProjectName: string
  /** The library's current package name */
  currentPackageName: string
  /** The library's new package name */
  newPackageName: string
}

/**
 * The project that tests a library: the one with an `e2e` target that implicitly depends on it.
 *
 * @param tree - The tree the projects are read from
 * @param projectName - The library's project name
 * @returns The e2e project, or undefined when none depends on the library
 *
 * @example Found by its dependency, not by its name
 * ```typescript
 * e2eProjectOf(tree, 'lib-core')
 * // => { name: 'e2e-lib-core', root: 'e2e/core', implicitDependencies: ['lib-core'], targets: { e2e: {} } }
 * e2eProjectOf(tree, 'docs-site') // => undefined
 * ```
 */
export function e2eProjectOf(tree: Tree, projectName: string): ProjectConfiguration | undefined {
  return [...getProjects(tree).values()].find(
    (project) => project.targets?.[E2E_TARGET] !== undefined && (project.implicitDependencies ?? []).includes(projectName)
  )
}

/**
 * The name an e2e project, or its package, takes after the library it tests is renamed: the
 * prefix kept, the old name replaced.
 *
 * @param current - The current name
 * @param oldName - The name of what it tests, as the current name carries it
 * @param newName - The new name of what it tests
 * @returns The new name, or the current one when it did not follow the convention
 */
function renamedAfter(current: string, oldName: string, newName: string): string {
  return current === `${E2E_PREFIX}${oldName}` ? `${E2E_PREFIX}${newName}` : current
}

/**
 * Brings the project that tests a library along with the library's rename: its project name,
 * its package name, the descriptions that mention the package, and the tarball it installs.
 * The project's directory stays where it is.
 *
 * @param tree - The tree the projects live in
 * @param rename - The library's old and new names
 * @returns The e2e project's root, or undefined when no project tests the library
 *
 * @example The e2e project follows the library's rename, in place
 * ```typescript
 * renameE2eProject(tree, {
 *   currentProjectName: 'lib-core',
 *   newProjectName: 'lib-kernel',
 *   currentPackageName: '@acme/core',
 *   newPackageName: '@acme/kernel',
 * })
 * // => 'e2e/core': its project.json name e2e-lib-core became e2e-lib-kernel, its package.json name @acme/e2e-core became @acme/e2e-kernel,
 * //    and the dependency pin "file:../../packs/acme-core-1.0.0.tgz" became "file:../../packs/acme-kernel-1.0.0.tgz"
 * ```
 */
export function renameE2eProject(tree: Tree, rename: E2eRename): string | undefined {
  const project = e2eProjectOf(tree, rename.currentProjectName) ?? e2eProjectOf(tree, rename.newProjectName)
  if (project === undefined) return undefined
  updateJson<NamedJson>(tree, joinPathFragments(project.root, 'project.json'), (json) => {
    if (json.name !== undefined) json.name = renamedAfter(json.name, rename.currentProjectName, rename.newProjectName)
    replaceDescriptionPackageName(json, rename.currentPackageName, rename.newPackageName)
    return json
  })
  const packageJsonPath = joinPathFragments(project.root, 'package.json')
  if (!tree.exists(packageJsonPath)) return project.root
  updateJson<E2ePackageManifest>(tree, packageJsonPath, (json) => {
    if (json.name !== undefined) {
      const scope = json.name.slice(0, json.name.length - unscopedName(json.name).length)
      json.name = `${scope}${renamedAfter(unscopedName(json.name), unscopedName(rename.currentPackageName), unscopedName(rename.newPackageName))}`
    }
    replaceDescriptionPackageName(json, rename.currentPackageName, rename.newPackageName)
    const pinned = json.dependencies?.[rename.currentPackageName]
    if (json.dependencies !== undefined && pinned !== undefined) {
      delete json.dependencies[rename.currentPackageName]
      json.dependencies[rename.newPackageName] = pinned.replaceAll(
        `${tarballStem(rename.currentPackageName)}-`,
        `${tarballStem(rename.newPackageName)}-`
      )
    }
    return json
  })
  return project.root
}
