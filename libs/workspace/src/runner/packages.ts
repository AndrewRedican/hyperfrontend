/**
 * Where the executors and generators of a package live: the workspace project whose
 * `package.json` carries the package's name, else the package installed in the workspace's
 * `node_modules`. Either names a manifest in its `package.json`, and the manifest names modules,
 * with or without an extension, and schemas, each beside the manifest or under the package's
 * `src` directory.
 *
 * @module runner/packages
 */

import type { PackageManifest, ProjectRecord } from '../graph/model'
import { join } from 'node:path'
import { isFile } from '@hyperfrontend/project-scope/core'
import { readJson } from '../graph/workspace'

/** What a package contributes through a manifest its `package.json` names. */
export type Contribution = 'executors' | 'generators'

/** What a module path may end in when a manifest writes it without an extension, in the order tried. */
const MODULE_EXTENSIONS = ['', '.ts', '.js', '.mjs', '.cjs']

/** The directory a package keeps its sources in, where a path of its manifest is looked for when the package's own directory has no such file. */
const SOURCE_DIRECTORY = 'src'

/**
 * The manifest of a package's executors or generators.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param packageName - The name its `package.json` gives the package
 * @param contribution - Which manifest is asked for
 * @returns The manifest's path, or undefined when neither a workspace project nor an installed package of that name declares one
 */
export function contributionManifest(
  root: string,
  projects: ReadonlyMap<string, ProjectRecord>,
  packageName: string,
  contribution: Contribution
): string | undefined {
  for (const project of projects.values()) {
    const manifest = project.manifest
    if (manifest?.name === packageName && manifest[contribution] !== undefined) return join(root, project.root, manifest[contribution])
  }
  const installed = join(root, 'node_modules', ...packageName.split('/'))
  const declared = readJson<PackageManifest>(join(installed, 'package.json'))?.[contribution]
  return declared === undefined ? undefined : join(installed, declared)
}

/**
 * The file a manifest names. A built package keeps its files beside the manifest and its
 * source keeps them under `src`, so one manifest serves both: the path is looked for beside
 * the manifest first, then under `src`.
 *
 * @param directory - The directory of the manifest, absolute
 * @param written - The file as the manifest writes it, relative to the manifest
 * @returns The file where it exists, or undefined
 */
export function packagedFile(directory: string, written: string): string | undefined {
  return [join(directory, written), join(directory, SOURCE_DIRECTORY, written)].find(isFile)
}

/**
 * The file a manifest names as a module, written with or without its extension.
 *
 * @param directory - The directory of the manifest, absolute
 * @param written - The module as the manifest writes it, relative to the manifest
 * @returns The file as written when it is one, else the first that exists with a TypeScript or JavaScript extension added, beside the manifest or under `src`; undefined when none does
 */
export function moduleFile(directory: string, written: string): string | undefined {
  for (const base of [directory, join(directory, SOURCE_DIRECTORY)]) {
    const file = MODULE_EXTENSIONS.map((extension) => join(base, `${written}${extension}`)).find(isFile)
    if (file !== undefined) return file
  }
  return undefined
}
