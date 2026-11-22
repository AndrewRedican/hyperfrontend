/**
 * The projects that test a library's package: found by what they depend on, and brought along
 * when the library is renamed.
 *
 * @module generators/shared/e2e-project
 */

import type { NamedJson } from './json-updaters'
import type { ProjectConfiguration } from './projects'
import type { Tree } from './tree'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { tarballStem } from '../../executors/version/lib/update-e2e-dependencies'
import { replaceDescriptionPackageName } from './json-updaters'
import { getPackageNameFromProject } from './package-json'
import { joinPathFragments } from './paths'
import { assertPackageNameFree, assertProjectNameFree, getProjects } from './projects'
import { unscopedName } from './scope'
import { amendJson } from './tree'

/** The target an e2e project runs. */
export const E2E_TARGET = 'e2e'

/** The prefix an e2e project's name and its package's name carry before the name of what they test. */
export const E2E_PREFIX = 'e2e-'

/** The extension of the tarball `npm pack` writes. */
const TARBALL_EXTENSION = '.tgz'

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
 * The projects that test a library: every one with an `e2e` target that implicitly depends on it,
 * under any of the names given.
 *
 * @param tree - The tree the projects are read from
 * @param projectNames - The names the library goes by, such as its current one and the one it takes
 * @returns The e2e projects in path order, none when no project tests the library
 *
 * @example Found by their dependency, not by their names
 * ```typescript
 * e2eProjectsOf(tree, ['lib-core'])
 * // => [{ name: 'e2e-lib-core', root: 'e2e/core', implicitDependencies: ['lib-core'], targets: { e2e: {} } }]
 * e2eProjectsOf(tree, ['docs-site']) // => []
 * ```
 */
export function e2eProjectsOf(tree: Tree, projectNames: readonly string[]): ProjectConfiguration[] {
  return [...getProjects(tree).values()].filter(
    (project) =>
      project.targets?.[E2E_TARGET] !== undefined && (project.implicitDependencies ?? []).some((name) => projectNames.includes(name))
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
 * The name the package of an e2e project takes after the library it tests is renamed: its own
 * scope kept, and its name following the library's where it was named after it.
 *
 * @param current - The e2e package's current name, such as `@acme/e2e-core`
 * @param rename - The library's old and new names
 * @returns The new name, or the current one when it did not follow the convention
 */
function renamedPackage(current: string, rename: E2eRename): string {
  const scope = current.slice(0, current.length - unscopedName(current).length)
  return `${scope}${renamedAfter(unscopedName(current), unscopedName(rename.currentPackageName), unscopedName(rename.newPackageName))}`
}

/**
 * Refuses a rename of a library that would give a project testing it the name another project
 * holds, or give that project's package the name another package holds: what a rename is checked
 * against before anything is written, so the projects brought along never end up sharing a name.
 *
 * @param tree - The tree the projects are read from, the library still under its current names
 * @param rename - The library's old and new names
 * @throws {Error} When a name a project that tests the library would take is already in use
 *
 * @example Before a library and the project that tests it are renamed
 * ```typescript
 * assertE2eRenameFree(tree, {
 *   currentProjectName: 'core',
 *   newProjectName: 'nucleus',
 *   currentPackageName: '@acme/core',
 *   newPackageName: '@acme/nucleus',
 * })
 * // throws "Project name already in use: 'e2e-nucleus' is the project at e2e/x" when e2e-core would take the name of the project at e2e/x
 * ```
 */
export function assertE2eRenameFree(tree: Tree, rename: E2eRename): void {
  for (const project of e2eProjectsOf(tree, [rename.currentProjectName])) {
    const name = renamedAfter(project.name, rename.currentProjectName, rename.newProjectName)
    // why: the name the library leaves is free by the time the project that tests it takes it
    if (name !== project.name && name !== rename.currentProjectName) assertProjectNameFree(tree, name)
    const packageName = getPackageNameFromProject(tree, project.root)
    if (packageName === null) continue
    const renamed = renamedPackage(packageName, rename)
    if (renamed !== packageName && renamed !== rename.currentPackageName) assertPackageNameFree(tree, renamed, project.root)
  }
}

/**
 * A dependency pin with the tarball it names renamed after the package: the file that is the
 * package's stem, a dash and a version. A directory on the way that repeats the stem, and the
 * tarball of a package whose stem only starts with it, are left as they are.
 *
 * @param pin - The pin as written, such as `file:../../packs/acme-core-1.0.0.tgz`
 * @param currentStem - The stem of the package's current name
 * @param newStem - The stem of its new name
 * @returns The pin naming the tarball of the renamed package, or the pin as it is
 */
function repinned(pin: string, currentStem: string, newStem: string): string {
  const fileAt = max(pin.lastIndexOf('/'), pin.indexOf(':')) + 1
  const file = pin.slice(fileAt)
  const own = file.endsWith(TARBALL_EXTENSION) && file.startsWith(`${currentStem}-`) && /^\d/.test(file.slice(currentStem.length + 1))
  return own ? `${pin.slice(0, fileAt)}${newStem}${file.slice(currentStem.length)}` : pin
}

/**
 * Brings the projects that test a library along with the library's rename: the project name and
 * the package name of the one named after the library, and in each of them the descriptions that
 * mention the package and the tarball it installs. Every project that tests the library follows,
 * whichever stands first, and each project's directory stays where it is.
 *
 * @param tree - The tree the projects live in
 * @param rename - The library's old and new names
 * @returns The roots of the e2e projects in path order, none when no project tests the library
 *
 * @example The e2e project follows the library's rename, in place
 * ```typescript
 * renameE2eProjects(tree, {
 *   currentProjectName: 'lib-core',
 *   newProjectName: 'lib-kernel',
 *   currentPackageName: '@acme/core',
 *   newPackageName: '@acme/kernel',
 * })
 * // => ['e2e/core']: its project.json name e2e-lib-core became e2e-lib-kernel, its package.json name @acme/e2e-core became @acme/e2e-kernel,
 * //    and the dependency pin "file:../../packs/acme-core-1.0.0.tgz" became "file:../../packs/acme-kernel-1.0.0.tgz"
 * ```
 */
export function renameE2eProjects(tree: Tree, rename: E2eRename): string[] {
  // why: the references of the other projects are renamed before this runs, so a project that tests the library may name it either way
  const projects = e2eProjectsOf(tree, [rename.currentProjectName, rename.newProjectName])
  for (const project of projects) {
    amendJson<NamedJson>(tree, joinPathFragments(project.root, 'project.json'), (json) => {
      if (json.name !== undefined) json.name = renamedAfter(json.name, rename.currentProjectName, rename.newProjectName)
      replaceDescriptionPackageName(json, rename.currentPackageName, rename.newPackageName)
      return json
    })
    const packageJsonPath = joinPathFragments(project.root, 'package.json')
    if (!tree.exists(packageJsonPath)) continue
    amendJson<E2ePackageManifest>(tree, packageJsonPath, (json) => {
      if (json.name !== undefined) json.name = renamedPackage(json.name, rename)
      replaceDescriptionPackageName(json, rename.currentPackageName, rename.newPackageName)
      const pinned = json.dependencies?.[rename.currentPackageName]
      if (json.dependencies !== undefined && pinned !== undefined) {
        delete json.dependencies[rename.currentPackageName]
        json.dependencies[rename.newPackageName] = repinned(
          pinned,
          tarballStem(rename.currentPackageName),
          tarballStem(rename.newPackageName)
        )
      }
      return json
    })
  }
  return projects.map((project) => project.root)
}
