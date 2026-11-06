/**
 * The generator a name on the command line means. `<package>:<name>` is the generator of that
 * package, found the way an executor is. A bare name is looked up in the workspace projects that
 * declare generators, so a workspace's own generator stands in front of a packaged one of the
 * same name, then in the engine's own package.
 *
 * @module runner/generators
 */

import type { ProjectRecord } from '../graph/model'
import type { GeneratorEntry, GeneratorsManifest } from './contract'
import type { GeneratorSchema } from './generate'
import { dirname } from 'node:path'
import { hasOwn, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../graph/workspace'
import { contributionManifest, moduleFile, packagedFile } from './packages'
import { refusal } from './refusal'

/** The package whose generators answer to a bare name when no workspace project offers it. */
export const ENGINE_PACKAGE = '@hyperfrontend/workspace'

/** Where a generator lives. */
export interface GeneratorSource {
  /** The module implementing it, absolute. */
  readonly file: string
  /** The schema of its options. */
  readonly schema: GeneratorSchema
}

/** The generators one package lists. */
interface Listing {
  /** The package. */
  readonly packageName: string
  /** Its manifest of generators, absolute. */
  readonly manifestFile: string
  /** The generators by name. */
  readonly generators: Readonly<Record<string, GeneratorEntry>>
}

/**
 * The generators a package lists.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param packageName - The package asked
 * @returns The listing, or undefined when neither a workspace project nor an installed package of that name declares generators
 */
function listingOf(root: string, projects: ReadonlyMap<string, ProjectRecord>, packageName: string): Listing | undefined {
  const manifestFile = contributionManifest(root, projects, packageName, 'generators')
  if (manifestFile === undefined) return undefined
  return { packageName, manifestFile, generators: readJson<GeneratorsManifest>(manifestFile)?.generators ?? {} }
}

/**
 * The generators the workspace's own projects list.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @returns One listing per project whose manifest declares generators
 */
function workspaceListings(root: string, projects: ReadonlyMap<string, ProjectRecord>): Listing[] {
  return [...projects.values()].flatMap((project) => {
    const manifest = project.manifest
    return manifest?.name === undefined || manifest.generators === undefined ? [] : [listingOf(root, projects, manifest.name) as Listing]
  })
}

/**
 * Every generator a name could mean, as `<package>:<name>`.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @returns The generators of the workspace's projects, then the engine's own
 */
export function generatorNames(root: string, projects: ReadonlyMap<string, ProjectRecord>): string[] {
  const own = workspaceListings(root, projects)
  const engine = own.some((listing) => listing.packageName === ENGINE_PACKAGE) ? undefined : listingOf(root, projects, ENGINE_PACKAGE)
  return [...own, ...(engine === undefined ? [] : [engine])].flatMap((listing) =>
    keys(listing.generators).map((name) => `${listing.packageName}:${name}`)
  )
}

/**
 * The package a bare generator name belongs to: the one workspace project that lists it, else
 * the engine's.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param name - The generator's name
 * @returns The listing, or undefined when the engine's package is not there to fall back on
 * @throws {Error} When two workspace projects list the name
 */
function listingOfBare(root: string, projects: ReadonlyMap<string, ProjectRecord>, name: string): Listing | undefined {
  const offering = workspaceListings(root, projects).filter((listing) => hasOwn(listing.generators, name))
  if (offering.length > 1)
    throw refusal(`${offering.map((listing) => `${listing.packageName}:${name}`).join(' and ')} both answer to ${name}; name the package`)
  return offering[0] ?? listingOf(root, projects, ENGINE_PACKAGE)
}

/**
 * Where the generator a name means lives.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param written - The generator as the command line names it, `<name>` or `<package>:<name>`
 * @returns The module and the options schema
 * @throws {Error} When nothing provides the generator, two workspace projects answer to a bare name, or its module or schema is missing
 */
export function locateGenerator(root: string, projects: ReadonlyMap<string, ProjectRecord>, written: string): GeneratorSource {
  const colon = written.lastIndexOf(':')
  const name = written.slice(colon + 1)
  const listing = colon > 0 ? listingOf(root, projects, written.slice(0, colon)) : listingOfBare(root, projects, name)
  const entry = listing?.generators[name]
  if (listing === undefined || entry === undefined) throw refusal(`no generator ${written}: ${generatorNames(root, projects).join(', ')}`)
  const directory = dirname(listing.manifestFile)
  const file = moduleFile(directory, entry.factory)
  if (file === undefined) throw refusal(`the module implementing the generator ${written} is missing: ${entry.factory}`)
  const schemaFile = packagedFile(directory, entry.schema)
  const schema = schemaFile === undefined ? null : readJson<GeneratorSchema>(schemaFile)
  if (schema === null) throw refusal(`the options schema of the generator ${written} is missing or does not parse: ${entry.schema}`)
  return { file, schema }
}
