/**
 * The executor a target names, `<package>:<name>`: the workspace project or the installed
 * package of that name lists it in its `executors.json`, with the module whose default export
 * implements it and the schema of its options, whose defaults fill the options a run leaves
 * unset.
 *
 * @module runner/executors
 */

import type { ProjectRecord } from '../graph/model'
import type { ExecutorContext, ExecutorsManifest } from './contract'
import { dirname } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../graph/workspace'
import { contributionManifest, moduleFile, packagedFile } from './packages'
import { refusal } from './refusal'

/** A module as the runner reads it: its exports by name. */
export type ExecutorModule = Readonly<Record<string, unknown>>

/** Imports a module from its absolute path. */
export type ImportModule = (file: string) => Promise<ExecutorModule>

/** An executor: called with the options and the context, it answers a promise of its result. */
export type ExecutorFunction = (options: Record<string, unknown>, context: ExecutorContext) => unknown

/** One option of an executor's schema, as far as the runner reads it. */
export interface SchemaProperty {
  /** The JSON type. */
  readonly type?: string
  /** The value the option takes when a run leaves it unset. */
  readonly default?: unknown
}

/** An executor's options schema, as far as the runner reads it. */
export interface ExecutorSchema {
  /** The options. */
  readonly properties?: Readonly<Record<string, SchemaProperty>>
}

/** What an executor answers when it resolves, as far as the runner reads it. */
interface ExecutorResult {
  /** Whether the executor succeeded. */
  readonly success?: unknown
}

/** Where an executor lives. */
export interface ExecutorSource {
  /** The module implementing it, absolute. */
  readonly file: string
  /** The schema of its options. */
  readonly schema: ExecutorSchema
}

/**
 * Where the executor a target names lives.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param executor - The executor, `<package>:<name>`
 * @returns The module and the options schema
 * @throws {Error} When no workspace project and no installed package provides the executor, or its manifest entry, module or schema is missing
 *
 * @example Finding a packaged executor
 * ```typescript
 * import { discoverProjects, listFiles } from '@hyperfrontend/workspace/graph'
 * import { locateExecutor } from '@hyperfrontend/workspace/runner'
 *
 * const projects = discoverProjects(root, listFiles(root))
 * locateExecutor(root, projects, '@hyperfrontend/workspace:typecheck')
 * // => { file: '/repo/node_modules/@hyperfrontend/workspace/executors/typecheck/index.js', schema: { properties: { tsConfig: { type: 'string' }, ... } } }
 * ```
 *
 * @example A workspace project stands in front of the installed package of the same name
 * ```typescript
 * locateExecutor(root, projects, '@acme/tooling:lint')
 * // => { file: '/repo/tools/tooling/src/executors/lint/index.ts', schema: { ... } } while tools/tooling carries @acme/tooling
 * ```
 */
export function locateExecutor(root: string, projects: ReadonlyMap<string, ProjectRecord>, executor: string): ExecutorSource {
  const colon = executor.indexOf(':')
  if (colon <= 0) throw refusal(`the executor ${executor} is not written as <package>:<name>`)
  const packageName = executor.slice(0, colon)
  const manifestFile = contributionManifest(root, projects, packageName, 'executors')
  if (manifestFile === undefined) throw refusal(`no workspace project and no installed package provides the executors of ${packageName}`)
  const name = executor.slice(colon + 1)
  const entry = readJson<ExecutorsManifest>(manifestFile)?.executors?.[name]
  if (entry === undefined) throw refusal(`${packageName} lists no executor ${name} in ${manifestFile}`)
  if (typeof entry.implementation !== 'string')
    throw refusal(
      `the executor ${executor} names no implementation in ${manifestFile}: an executors.json names each module under "implementation", where a generators.json uses "factory"`
    )
  const directory = dirname(manifestFile)
  const file = moduleFile(directory, entry.implementation)
  if (file === undefined) throw refusal(`the module implementing ${executor} is missing: ${entry.implementation}`)
  const schemaFile = packagedFile(directory, entry.schema)
  const schema = schemaFile === undefined ? null : readJson<ExecutorSchema>(schemaFile)
  if (schema === null) throw refusal(`the options schema of ${executor} is missing or does not parse: ${entry.schema}`)
  return { file, schema }
}

/**
 * Options with the defaults of their schema filled in where they are unset.
 *
 * @param options - The options of the target and the command line
 * @param schema - The executor's options schema
 * @returns A copy of the options with the defaults applied
 *
 * @example Filling the options a target left unset
 * ```typescript
 * withDefaults({ tsConfig: 'libs/core/tsconfig.lib.json' }, { properties: { tsConfig: { type: 'string' }, strict: { type: 'boolean', default: true } } })
 * // => { tsConfig: 'libs/core/tsconfig.lib.json', strict: true }
 * ```
 */
export function withDefaults(options: Readonly<Record<string, unknown>>, schema: ExecutorSchema): Record<string, unknown> {
  const filled = { ...options }
  for (const [name, property] of entries(schema.properties ?? {})) {
    if (filled[name] === undefined && property.default !== undefined) filled[name] = property.default
  }
  return filled
}

/**
 * Imports the module implementing an executor and finds its default export.
 *
 * @param source - Where the executor lives
 * @param importModule - Imports a module from its path
 * @param executor - The executor, for the error
 * @returns The executor function
 * @throws {Error} When the module's default export is not a function
 *
 * @example Calling an executor outside a task
 * ```typescript
 * import { pathToFileURL } from 'node:url'
 * import { loadExecutor, locateExecutor, withDefaults } from '@hyperfrontend/workspace/runner'
 *
 * const source = locateExecutor(root, projects, '@acme/tooling:lint')
 * const lint = await loadExecutor(source, (file) => import(pathToFileURL(file).href), '@acme/tooling:lint')
 * const result = await lint(withDefaults({ fix: true }, source.schema), context)
 * // => whatever the executor answers, { success: true } when it passed
 * ```
 */
export async function loadExecutor(source: ExecutorSource, importModule: ImportModule, executor: string): Promise<ExecutorFunction> {
  const implementation = (await importModule(source.file))['default']
  if (typeof implementation !== 'function') throw refusal(`${source.file} has no default export implementing ${executor}`)
  return implementation as ExecutorFunction
}

/**
 * Whether an executor succeeded, from what it answered.
 *
 * @param answer - What the executor answered: its result, or a promise of it
 * @returns True when the result is an object whose `success` is truthy
 *
 * @example An executor that answers nothing has failed
 * ```typescript
 * await settle(Promise.resolve({ success: true })) // true
 * await settle(undefined) // false
 * ```
 */
export async function settle(answer: unknown): Promise<boolean> {
  const result = await answer
  return typeof result === 'object' && result !== null && Boolean((result as ExecutorResult).success)
}
