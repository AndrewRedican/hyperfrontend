/**
 * The targets of a project as the runner executes them. A project's own target is laid over
 * the `nx.json` defaults that apply to it: the entry under its executor when there is one, else
 * the entry under its name, and only when the two are compatible (the same executor or one
 * naming none, and for `nx:run-commands` the same command or one naming none). The project's
 * options win over the defaults', a bare `command` reads as an `nx:run-commands` target, and
 * the `{workspaceRoot}`, `{projectRoot}` and `{projectName}` tokens of the options are replaced.
 *
 * @module runner/targets
 */

import type { NxJsonConfiguration, TargetConfiguration } from '@hyperfrontend/integration-nx/compat'
import type { TargetDefaults } from '../graph/inputs'
import type { ProjectRecord } from '../graph/model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries, fromEntries, hasOwn, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isCompatibleTarget } from '../graph/inputs'
import { refusal } from './refusal'

/** The executor of a target that runs shell commands. */
export const RUN_COMMANDS = 'nx:run-commands'

/** The options of a target. */
export type Options = Record<string, unknown>

/** A target as `project.json` or `nx.json` writes it. */
export type Target = TargetConfiguration<Options>

/** A target merged with its defaults and its tokens replaced: what a task of it runs with. */
export interface ResolvedTarget extends Target {
  /** The options, empty when neither the target nor its defaults set any. */
  options: Options
}

/** A project and the target of it a task id names. */
export interface TaskTarget {
  /** The project. */
  readonly project: ProjectRecord
  /** The target's name. */
  readonly target: string
}

/** The characters that make a `targetDefaults` key a pattern rather than a name. */
const PATTERN_CHARACTERS = ['*', '|', '{', '}', '(', ')', '[']

/**
 * A target with a bare `command` read as the `nx:run-commands` target it stands for.
 *
 * @param target - The target as written
 * @param where - Where the target is written, for the error
 * @returns The target, its command moved into its options
 * @throws {Error} When the target names both an executor and a command
 */
export function desugar(target: Target, where: string): Target {
  const { command, ...rest } = target
  if (command === undefined) return target
  if (rest.executor !== undefined) throw refusal(`${where} names both an executor and a command`)
  return { ...rest, executor: RUN_COMMANDS, options: { ...rest.options, command } }
}

/**
 * The `targetDefaults` key that applies to a target: its executor's when `nx.json` has one, else
 * its name's.
 *
 * @param defaults - The `targetDefaults` of `nx.json`
 * @param name - The target's name
 * @param executor - The executor the project's target names, if any
 * @returns The key, or undefined when neither is a key
 */
function defaultsKey(defaults: Readonly<Record<string, unknown>>, name: string, executor: string | undefined): string | undefined {
  if (executor !== undefined && hasOwn(defaults, executor)) return executor
  return hasOwn(defaults, name) ? name : undefined
}

/**
 * The workspace defaults of a target.
 *
 * @param nx - The workspace configuration
 * @param name - The target's name
 * @param executor - The executor the project's target names, if any
 * @returns The defaults, read like a target, or undefined when none apply
 * @throws {Error} When the defaults use a form the runner does not read: a key written as a pattern, or a list of filtered entries
 */
export function defaultsFor(nx: NxJsonConfiguration, name: string, executor: string | undefined): Target | undefined {
  const defaults = nx.targetDefaults ?? {}
  const key = defaultsKey(defaults, name, executor)
  if (key === undefined) {
    const pattern = keys(defaults).find((candidate) => [...candidate].some((character) => PATTERN_CHARACTERS.includes(character)))
    if (pattern !== undefined)
      throw refusal(`nx.json targetDefaults key ${pattern} is a pattern, and patterns are not matched against target names`)
    return undefined
  }
  const entry = defaults[key]
  if (isArray(entry)) throw refusal(`nx.json targetDefaults.${key} is a list of filtered entries, which are not read`)
  return desugar(entry as Target, `nx.json targetDefaults.${key}`)
}

/**
 * What decides whether two targets are compatible: the executor and the command or script.
 *
 * @param target - A target
 * @returns The fields the compatibility check reads
 */
function identity(target: Target): TargetDefaults {
  const options = target.options ?? {}
  return {
    executor: target.executor,
    options: {
      command: options['command'] as string | undefined,
      commands: options['commands'] as readonly string[] | undefined,
      script: options['script'] as string | undefined,
    },
  }
}

/**
 * A project's target laid over its defaults: the project's fields win, and the options merge
 * with the project's winning. Defaults that are not compatible with the target are dropped.
 *
 * @param own - The project's target
 * @param defaults - The defaults, if any apply
 * @returns The merged target
 */
export function mergeTarget(own: Target, defaults: Target | undefined): Target {
  if (defaults === undefined || !isCompatibleTarget(identity(own), identity(defaults))) return own
  return { ...defaults, ...own, options: { ...defaults.options, ...own.options } }
}

/**
 * A string option with its tokens replaced: `{workspaceRoot}` at its start is dropped, leaving a
 * workspace-relative path, and `{projectRoot}` and `{projectName}` become the project's.
 *
 * @param text - The option's value
 * @param project - The project the target belongs to
 * @param where - The option, for the error
 * @returns The value, tokens replaced
 * @throws {Error} When `{workspaceRoot}` appears anywhere but at the start
 */
function replaceTokens(text: string, project: ProjectRecord, where: string): string {
  const relative = text.replace(/^\{workspaceRoot\}\/?/, '')
  if (relative.includes('{workspaceRoot}')) throw refusal(`${where} uses {workspaceRoot} after its start, where the token is not read`)
  return relative.replaceAll('{projectRoot}', project.root).replaceAll('{projectName}', project.name)
}

/**
 * A value of the options with the tokens of every string inside it replaced.
 *
 * @param value - An option's value, or the options themselves
 * @param project - The project the target belongs to
 * @param where - Where the value sits, for the error
 * @returns The value, tokens replaced
 */
export function interpolate(value: unknown, project: ProjectRecord, where: string): unknown {
  if (typeof value === 'string') return replaceTokens(value, project, where)
  if (isArray(value)) return value.map((item) => interpolate(item, project, where))
  if (typeof value !== 'object' || value === null) return value
  return fromEntries(entries(value).map(([key, item]) => [key, interpolate(item, project, `${where}.${key}`)]))
}

/**
 * One target of a project as a task of it runs.
 *
 * @param nx - The workspace configuration
 * @param project - The project the target belongs to
 * @param name - The name the project gives the target
 * @param written - The target as the project writes it
 * @returns The target merged with its defaults, its options' tokens replaced
 */
export function resolveTarget(nx: NxJsonConfiguration, project: ProjectRecord, name: string, written: Target): ResolvedTarget {
  const where = `${project.name}:${name}`
  const own = desugar(written, where)
  const merged = mergeTarget(own, defaultsFor(nx, name, own.executor))
  return { ...merged, options: interpolate(merged.options ?? {}, project, `${where} options`) as Options }
}

/**
 * Every target of a project as tasks of it run.
 *
 * @param nx - The workspace configuration
 * @param project - The project whose targets are read
 * @returns The resolved targets by name
 */
export function projectTargets(nx: NxJsonConfiguration, project: ProjectRecord): Record<string, ResolvedTarget> {
  return fromEntries(
    entries(project.configuration?.targets ?? {}).map(([name, written]) => [name, resolveTarget(nx, project, name, written as Target)])
  )
}

/**
 * The project and target a task id names. The project is the id up to its first colon, and the
 * target the longest name of the project's targets the rest starts with; anything after that
 * would name a configuration.
 *
 * @param id - `<project>:<target>`
 * @param projects - The workspace's projects by name
 * @returns The project and the target's name
 * @throws {Error} When the id names no project, no target of it, or a configuration
 */
export function parseTaskId(id: string, projects: ReadonlyMap<string, ProjectRecord>): TaskTarget {
  const [name, ...segments] = id.split(':') as [string, ...string[]]
  const rest = segments.join(':')
  if (name === '' || rest === '') throw refusal(`expected <project>:<target>, got ${id}`)
  const project = projects.get(name)
  if (project === undefined) throw refusal(`no project named ${name}`)
  const target = keys(project.configuration?.targets ?? {})
    .filter((candidate) => rest === candidate || rest.startsWith(`${candidate}:`))
    .sort((left, right) => right.length - left.length)[0]
  if (target === undefined) throw refusal(`project ${name} has no target ${rest}`)
  if (target !== rest) throw refusal(`${id} names the configuration ${rest.slice(target.length + 1)}; targets run without configurations`)
  return { project, target }
}

/**
 * The executor a task of a target runs.
 *
 * @param target - The resolved target
 * @param id - The task id, for the error
 * @returns The executor, `<package>:<name>`
 * @throws {Error} When the target runs a configuration by default or names no executor
 */
export function executorOf(target: ResolvedTarget, id: string): string {
  if (target.defaultConfiguration !== undefined)
    throw refusal(`${id} runs the configuration ${target.defaultConfiguration} by default; targets run without configurations`)
  if (target.executor === undefined) throw refusal(`${id} names no executor and no command`)
  return target.executor
}
