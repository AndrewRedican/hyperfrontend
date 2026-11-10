/**
 * The generator a name on the command line means. `<package>:<name>` is the generator of that
 * package, found the way an executor is. A bare name is looked up in the workspace projects that
 * declare generators, so a workspace's own generator stands in front of a packaged one of the
 * same name, then in the engine's own package, whether that is installed or is itself a project
 * of the workspace.
 *
 * @module runner/generators
 */

import type { ProjectRecord } from '../graph/model'
import type { Generator, GeneratorEntry, GeneratorsManifest, Tree } from './contract'
import type { ImportModule } from './executors'
import type { GeneratorSchema } from './generate'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { hasOwn, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { discoverProjects, listFiles, readJson } from '../graph/workspace'
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
 *
 * @example Listing what `npx hf generate` can run
 * ```typescript
 * import { discoverProjects, listFiles } from '@hyperfrontend/workspace/graph'
 * import { generatorNames } from '@hyperfrontend/workspace/runner'
 *
 * generatorNames(root, discoverProjects(root, listFiles(root)))
 * // => ['@acme/tooling:component', '@hyperfrontend/workspace:workspace', '@hyperfrontend/workspace:library', ...]
 * ```
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
 * the engine's. The engine's own listing never competes with a workspace project's, so the
 * workspace the engine is developed in overrides its generators like any other.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param name - The generator's name
 * @returns The listing, or undefined when the engine's package is not there to fall back on
 * @throws {Error} When two workspace projects list the name
 */
function listingOfBare(root: string, projects: ReadonlyMap<string, ProjectRecord>, name: string): Listing | undefined {
  const offering = workspaceListings(root, projects).filter(
    (listing) => listing.packageName !== ENGINE_PACKAGE && hasOwn(listing.generators, name)
  )
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
 *
 * @example A bare name prefers the workspace's own generator
 * ```typescript
 * locateGenerator(root, projects, 'library')
 * // => the library generator of a workspace project that lists one, else { file: '/repo/node_modules/@hyperfrontend/workspace/generators/library/index.js', schema: { ... } }
 * ```
 *
 * @example Naming the package settles it
 * ```typescript
 * locateGenerator(root, projects, '@hyperfrontend/workspace:library')
 * // => the engine's own, whatever the workspace lists under that name
 * ```
 */
export function locateGenerator(root: string, projects: ReadonlyMap<string, ProjectRecord>, written: string): GeneratorSource {
  const colon = written.lastIndexOf(':')
  const name = written.slice(colon + 1)
  const listing = colon > 0 ? listingOf(root, projects, written.slice(0, colon)) : listingOfBare(root, projects, name)
  const entry = listing?.generators[name]
  if (listing === undefined || entry === undefined) throw refusal(`no generator ${written}: ${generatorNames(root, projects).join(', ')}`)
  if (typeof entry.factory !== 'string')
    throw refusal(
      `the generator ${written} names no factory in ${listing.manifestFile}: a generators.json names each module under "factory", where an executors.json uses "implementation"`
    )
  const directory = dirname(listing.manifestFile)
  const file = moduleFile(directory, entry.factory)
  if (file === undefined) throw refusal(`the module implementing the generator ${written} is missing: ${entry.factory}`)
  const schemaFile = packagedFile(directory, entry.schema)
  const schema = schemaFile === undefined ? null : readJson<GeneratorSchema>(schemaFile)
  if (schema === null) throw refusal(`the options schema of the generator ${written} is missing or does not parse: ${entry.schema}`)
  return { file, schema }
}

/**
 * The generator a located module implements.
 *
 * @param source - Where the generator lives
 * @param importModule - Imports a module from its absolute path
 * @param written - The generator as the command line names it, for the refusal
 * @returns The module's default export
 * @throws {Error} When the module's default export is not a function
 *
 * @example Loading a generator the runner located
 * ```typescript
 * import { pathToFileURL } from 'node:url'
 * import { loadGenerator, locateGenerator } from '@hyperfrontend/workspace/runner'
 *
 * const generate = await loadGenerator(locateGenerator(root, projects, 'library'), (file) => import(pathToFileURL(file).href), 'library')
 * await generate(tree, { name: 'data-utils' })
 * ```
 */
export async function loadGenerator(source: GeneratorSource, importModule: ImportModule, written: string): Promise<Generator> {
  const implementation = (await importModule(source.file))['default']
  if (typeof implementation !== 'function') throw refusal(`${source.file} has no default export implementing the generator ${written}`)
  return implementation as Generator
}

/**
 * Runs the generator a name means over a tree, so a generator composes another by name: a
 * workspace's own generator of that name, else the engine's.
 *
 * @param tree - The tree the generator edits, rooted at the workspace
 * @param written - The generator as the command line names it, `<name>` or `<package>:<name>`
 * @param options - The options the generator is called with
 * @param importModule - Imports a module from its absolute path; the process's own import when omitted
 * @returns Resolves when the generator has run
 *
 * @example A workspace generator composing the packaged `library` generator
 * ```typescript
 * import type { Generator } from '@hyperfrontend/workspace/generators'
 * import { runGenerator } from '@hyperfrontend/workspace/generators'
 *
 * const featureLibrary: Generator<{ name: string }> = async (tree, options) => {
 *   await runGenerator(tree, 'library', { name: options.name, tags: ['type:feature'], skipFormat: true })
 *   tree.write(`libs/${options.name}/src/feature.ts`, 'export const feature = true\n')
 * }
 * export default featureLibrary
 * ```
 */
export async function runGenerator(
  tree: Tree,
  written: string,
  options: Record<string, unknown>,
  importModule: ImportModule = (file) => import(/* hf-graph: opaque */ pathToFileURL(file).href)
): Promise<void> {
  const projects = discoverProjects(tree.root, listFiles(tree.root))
  const generator = await loadGenerator(locateGenerator(tree.root, projects, written), importModule, written)
  await generator(tree, options)
}
