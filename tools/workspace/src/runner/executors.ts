/**
 * The executor a target names, `<package>:<name>`: the workspace project whose `package.json`
 * is that package lists it in its `executors.json`, with the TypeScript module whose default
 * export implements it and the schema of its options, whose defaults fill the options a run
 * leaves unset.
 *
 * @module runner/executors
 */

import type { ExecutorContext } from '@hyperfrontend/integration-nx/compat'
import type { ExecutorsManifest } from '@hyperfrontend/integration-nx/manifests'
import type { ProjectRecord } from '../graph/model'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../graph/workspace'
import { refusal } from './refusal'
import { RUN_COMMANDS } from './targets'

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
 * The `executors.json` of the workspace project that is a package.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param packageName - The name its `package.json` gives the package
 * @returns The manifest's path, or undefined when no project is the package or the package lists no executors
 */
function executorsManifestOf(root: string, projects: ReadonlyMap<string, ProjectRecord>, packageName: string): string | undefined {
  for (const project of projects.values()) {
    const manifest = project.manifest
    if (manifest?.name === packageName && manifest.executors !== undefined) return join(root, project.root, manifest.executors)
  }
  return undefined
}

/**
 * Where the executor a target names lives.
 *
 * @param root - The workspace root, absolute
 * @param projects - The workspace's projects by name
 * @param executor - The executor, `<package>:<name>`
 * @returns The module and the options schema
 * @throws {Error} When the executor is one of Nx's own, belongs to no workspace project, or its manifest entry, module or schema is missing
 */
export function locateExecutor(root: string, projects: ReadonlyMap<string, ProjectRecord>, executor: string): ExecutorSource {
  const colon = executor.indexOf(':')
  if (colon <= 0) throw refusal(`the executor ${executor} is not written as <package>:<name>`)
  const packageName = executor.slice(0, colon)
  if (packageName === 'nx')
    throw refusal(`the executor ${executor} is not supported; of the nx package's executors only ${RUN_COMMANDS} runs`)
  const manifestFile = executorsManifestOf(root, projects, packageName)
  if (manifestFile === undefined)
    throw refusal(`no workspace project provides the executors of ${packageName}; only the workspace's own executors run`)
  const name = executor.slice(colon + 1)
  const entry = readJson<ExecutorsManifest>(manifestFile)?.executors?.[name]
  if (entry === undefined) throw refusal(`${packageName} lists no executor ${name} in ${manifestFile}`)
  const directory = dirname(manifestFile)
  const file = join(directory, `${entry.implementation}.ts`)
  if (!existsSync(file)) throw refusal(`the module implementing ${executor} is missing: ${entry.implementation}.ts`)
  const schema = readJson<ExecutorSchema>(join(directory, entry.schema))
  if (schema === null) throw refusal(`the options schema of ${executor} is missing or does not parse: ${entry.schema}`)
  return { file, schema }
}

/**
 * Options with the defaults of their schema filled in where they are unset.
 *
 * @param options - The options of the target and the command line
 * @param schema - The executor's options schema
 * @returns A copy of the options with the defaults applied
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
 */
export async function settle(answer: unknown): Promise<boolean> {
  const result = await answer
  return typeof result === 'object' && result !== null && Boolean((result as ExecutorResult).success)
}
