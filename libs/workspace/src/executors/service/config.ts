/**
 * `service.config.ts`: what the file default-exports, the validator that reports every problem of
 * it at once and never a value, and the loader the build reads it with.
 *
 * @module executors/service/config
 */

import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { getPrototypeOf, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describeError, refusal } from '../../runner/refusal'

/** A JSON value. */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** What `service.config.ts` default-exports. */
export interface ServiceConfig {
  /** The immutable section: structural settings fixed when the service is built. An empty object when omitted. */
  readonly immutable?: Readonly<Record<string, JsonValue>>
}

/** What is wrong with a service configuration. */
export type ServiceConfigIssueCode =
  | 'config-not-object'
  | 'config-unknown-member'
  | 'immutable-not-object'
  | 'immutable-not-json'
  | 'immutable-too-deep'

/** One problem of a service configuration. */
export interface ServiceConfigIssue {
  /** What kind of problem it is. */
  readonly code: ServiceConfigIssueCode
  /** Where it is, such as `immutable.origins[2]`; empty for the export itself. */
  readonly path: string
  /** The problem in a sentence, holding member names and paths and never a value. */
  readonly message: string
}

/** Imports a module by its file. */
export type ImportConfigModule = (file: string) => Promise<unknown>

/** How deep the immutable section may nest, the section itself counted. */
const MAX_DEPTH = 32

/** A key that is an index of an array. */
const INDEX = /^(?:0|[1-9]\d*)$/

/** A key that is written after a dot in a path. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * Whether a value is a plain object: one whose prototype is `Object.prototype` or none.
 *
 * @param value - What a member holds
 * @returns True for an object literal and for an object created without a prototype
 */
function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype: unknown = getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

/**
 * Writes where a member of an object or of an array is.
 *
 * @param path - Where the object or the array is
 * @param key - What the object or the array names the member by
 * @returns The path, with a key that is no identifier in brackets
 */
function memberPath(path: string, key: string): string {
  return IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${stringify(key)}]`
}

/**
 * Words the problem of a member that is no JSON value.
 *
 * @param path - Where the member is
 * @returns The issue, which holds the path and never the value
 */
function notJson(path: string): ServiceConfigIssue {
  return {
    code: 'immutable-not-json',
    path,
    message: `${path} must be a JSON value: a string, a finite number, a boolean, null, an array or a plain object.`,
  }
}

/**
 * Collects what in a member of the immutable section is not a JSON value.
 *
 * @param value - The member
 * @param path - Where the member is
 * @param depth - How many objects and arrays enclose the member, itself counted when it is one
 * @param issues - The list the problems are added to, in document order
 */
function collect(value: unknown, path: string, depth: number, issues: ServiceConfigIssue[]): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && isFinite(value))) return
  if (!isArray(value) && !isPlain(value)) {
    issues.push(notJson(path))
  } else if (depth > MAX_DEPTH) {
    issues.push({ code: 'immutable-too-deep', path, message: `${path} nests deeper than ${MAX_DEPTH} levels.` })
  } else if (isArray(value)) {
    // why: a hole is read as undefined by index, where an iterator of the array's own members would step over it
    for (let index = 0; index < value.length; index += 1) collect(value[index], `${path}[${index}]`, depth + 1, issues)
    // why: a member an array holds beside its elements is not written as JSON, and one named toJSON would replace the array in the digest
    for (const key of keys(value).filter((member) => !INDEX.test(member))) issues.push(notJson(memberPath(path, key)))
  } else {
    for (const key of keys(value)) collect(value[key], memberPath(path, key), depth + 1, issues)
  }
}

/**
 * Checks what a `service.config.ts` exports by default, and reports every problem at once.
 *
 * @param value - The default export
 * @returns The problems in document order; none for a configuration the build can read
 *
 * @example A configuration with two problems
 * ```typescript
 * import { checkServiceConfig } from '@hyperfrontend/workspace/executors/service'
 *
 * checkServiceConfig({ immutable: { limits: { names: 3 } } }) // => []
 * checkServiceConfig({ immutable: { since: new Date(0) }, routes: [] }).map((issue) => issue.message)
 * // => [
 * //   'immutable.since must be a JSON value: a string, a finite number, a boolean, null, an array or a plain object.',
 * //   'the configuration has an unknown member "routes": it takes immutable.',
 * // ]
 * ```
 */
export function checkServiceConfig(value: unknown): readonly ServiceConfigIssue[] {
  if (!isPlain(value)) return [{ code: 'config-not-object', path: '', message: 'the default export must be a plain object.' }]
  const issues: ServiceConfigIssue[] = []
  for (const member of keys(value)) {
    if (member !== 'immutable') {
      issues.push({
        code: 'config-unknown-member',
        path: member,
        message: `the configuration has an unknown member ${stringify(member)}: it takes immutable.`,
      })
    } else if (!isPlain(value[member])) {
      // why: an omitted section is an empty one, and a member that is stated as undefined was omitted
      if (value[member] !== undefined)
        issues.push({ code: 'immutable-not-object', path: member, message: '"immutable" must be a plain object.' })
    } else {
      collect(value[member], member, 1, issues)
    }
  }
  return issues
}

/** A configuration module, as it is imported. */
interface ConfigModule {
  /** What the file exports by default. */
  readonly default?: unknown
}

/**
 * Loads a project's `service.config.ts` as the build reads it.
 *
 * @param file - The file, absolute
 * @param label - The file as messages name it, from the workspace root
 * @param importModule - Imports the file
 * @returns The configuration
 * @throws {Error} A refusal naming the file, when it cannot be imported or its default export has a problem
 *
 * @example Reading the section a service is built with
 * ```typescript
 * import { pathToFileURL } from 'node:url'
 *
 * const config = await loadServiceConfig('/repo/apps/hello/service.config.ts', 'apps/hello/service.config.ts', (file) => import(pathToFileURL(file).href))
 * config.immutable ?? {} // => { greeting: 'Hello' }
 * ```
 */
export async function loadServiceConfig(file: string, label: string, importModule: ImportConfigModule): Promise<ServiceConfig> {
  let loaded: unknown
  try {
    loaded = ((await importModule(file)) as ConfigModule).default
  } catch (error) {
    throw refusal(`${label}: ${describeError(error)}`)
  }
  const issues = checkServiceConfig(loaded)
  if (issues.length > 0) {
    throw refusal([`${label}: invalid service configuration:`, ...issues.map((issue) => `  - ${issue.message}`)].join('\n'))
  }
  return loaded as ServiceConfig
}
