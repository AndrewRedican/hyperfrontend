/**
 * The inputs and executors of a project's targets after the `nx.json` defaults apply, which they
 * do only when the target is compatible with the default, the way Nx merges them: the two name
 * the same executor or one names none, and a `run-commands` or `run-script` pair runs the same
 * command or script or one names none. Also: which
 * inputs a target reads, where they were configured, and the file patterns of the target's own
 * inputs with named inputs expanded.
 *
 * @module graph/inputs
 */

import type { ProjectRecord, TargetOptions, TargetRecord } from './model'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readJson } from './workspace'

/** An input of a target, as `nx.json` and `project.json` write it. */
export type InputDefinition = string | InputObject

/** An input written as an object. */
export interface InputObject {
  /** A file pattern. */
  readonly fileset?: string
  /** A named input. */
  readonly input?: string
  /** Whether the input is the dependencies' rather than the project's. */
  readonly dependencies?: boolean
  /** Whose input it is: `self`, `dependencies` or a list of projects. */
  readonly projects?: string | readonly string[]
}

/** A target's defaults, as far as they are read. */
export interface TargetDefaults {
  /** The inputs. */
  readonly inputs?: readonly InputDefinition[]
  /** The executor. */
  readonly executor?: string
  /** The options, as far as they identify a `run-commands` or `run-script` target. */
  readonly options?: TargetOptions
  /** The tasks the target runs after. */
  readonly dependsOn?: readonly unknown[]
}

/** A task dependency written as an object. */
export interface DependsOnObject {
  /** The target depended on. */
  readonly target?: string
  /** Whose target: the project's dependencies, named projects, or the project itself when absent. */
  readonly projects?: string | readonly string[]
  /** Whether the dependencies' target is meant. */
  readonly dependencies?: boolean
}

/** A task dependency: `target`, `^target`, or the object form. */
export type DependsOn = string | DependsOnObject

/** The inputs Nx gives a target configured without any. */
const IMPLICIT_INPUTS: readonly InputDefinition[] = ['default', '^default']

/** The workspace configuration, as far as the targets are read. */
export interface NxConfiguration {
  /** The named inputs. */
  readonly namedInputs?: Readonly<Record<string, readonly InputDefinition[]>>
  /** The defaults of each target. */
  readonly targetDefaults?: Readonly<Record<string, TargetDefaults>>
}

/** Where a target setting was configured. */
export type SettingSource = 'project' | 'defaults' | 'implicit'

/** A target setting with its origin. */
export interface Configured<Value> {
  /** The value in force. */
  readonly value: Value
  /** The project's configuration, the workspace defaults, or Nx's implicit default. */
  readonly from: SettingSource
}

/** The workspace configurations read so far, by root. */
const configurations = createMap<string, NxConfiguration>()

/**
 * The workspace configuration of a root, read once.
 *
 * @param root - The workspace root, absolute
 * @returns The configuration, empty without an `nx.json`
 */
export function readNxConfiguration(root: string): NxConfiguration {
  let nx = configurations.get(root)
  if (nx === undefined) {
    nx = readJson<NxConfiguration>(join(root, 'nx.json')) ?? {}
    configurations.set(root, nx)
  }
  return nx
}

/**
 * The inputs of a target: the project's own, else the workspace defaults, else Nx's implicit
 * `default` and `^default`.
 *
 * @param root - The workspace root, absolute
 * @param project - The project whose target is read
 * @param target - The target's name
 * @returns The inputs and where they come from
 */
export function targetInputs(root: string, project: ProjectRecord, target: string): Configured<readonly InputDefinition[]> {
  const own = project.configuration?.targets?.[target]?.inputs as readonly InputDefinition[] | undefined
  if (own !== undefined) return { value: own, from: 'project' }
  const defaults = targetDefaultsFor(root, project, target)?.inputs
  return defaults === undefined ? { value: IMPLICIT_INPUTS, from: 'implicit' } : { value: defaults, from: 'defaults' }
}

/**
 * What a `run-commands` or `run-script` target runs, which decides whether two such targets are
 * the same target.
 *
 * @param record - The target as written
 * @returns The command, the commands joined, or the script; undefined when the target names none
 */
function commandOf(record: TargetRecord | TargetDefaults): string | undefined {
  const { options } = record
  return options?.command ?? options?.commands?.join(' && ') ?? options?.script
}

/**
 * Whether the workspace defaults of a target apply to a project's target, as Nx decides it: they
 * do unless the two name different executors, or name the same `run-commands` or `run-script`
 * executor with different commands.
 *
 * @param own - The target as the project writes it, or undefined for a target the defaults alone define
 * @param defaults - The defaults for the target's name
 * @returns True when Nx would merge the defaults into the target
 */
export function isCompatibleTarget(own: TargetRecord | undefined, defaults: TargetDefaults): boolean {
  if (own?.executor === undefined || defaults.executor === undefined) return true
  if (own.executor !== defaults.executor) return false
  if (own.executor !== 'nx:run-commands' && own.executor !== 'nx:run-script') return true
  const left = commandOf(own)
  const right = commandOf(defaults)
  return left === undefined || right === undefined || left === right
}

/**
 * The workspace defaults that apply to a project's target: the entry under the target's name in
 * `nx.json`, when the target is compatible with it.
 *
 * @param root - The workspace root, absolute
 * @param project - The project whose target is read
 * @param target - The target's name
 * @returns The defaults, or null when there are none or they do not apply
 */
export function targetDefaultsFor(root: string, project: ProjectRecord, target: string): TargetDefaults | null {
  const defaults = readNxConfiguration(root).targetDefaults?.[target]
  if (defaults === undefined) return null
  return isCompatibleTarget(project.configuration?.targets?.[target], defaults) ? defaults : null
}

/**
 * The tasks a target runs after: the project's own `dependsOn`, else the workspace defaults.
 *
 * @param root - The workspace root, absolute
 * @param project - The project whose target is read
 * @param target - The target's name
 * @returns The dependencies as written, none when neither configures any
 */
export function targetDependsOn(root: string, project: ProjectRecord, target: string): readonly DependsOn[] {
  const own = project.configuration?.targets?.[target]?.dependsOn as readonly DependsOn[] | undefined
  return own ?? (targetDefaultsFor(root, project, target)?.dependsOn as readonly DependsOn[] | undefined) ?? []
}

/**
 * The executor of a target: the project's own, else the workspace defaults.
 *
 * @param root - The workspace root, absolute
 * @param project - The project whose target is read
 * @param target - The target's name
 * @returns The executor and where it comes from, or null when neither names one
 */
export function targetExecutor(root: string, project: ProjectRecord, target: string): Configured<string> | null {
  const own = project.configuration?.targets?.[target]?.executor
  if (own !== undefined) return { value: own, from: 'project' }
  const defaults = targetDefaultsFor(root, project, target)?.executor
  return defaults === undefined ? null : { value: defaults, from: 'defaults' }
}

/**
 * The file patterns of a target's own inputs, named inputs expanded, the dependencies' left out.
 *
 * @param root - The workspace root
 * @param project - The project whose target is read
 * @param target - The target's name
 * @returns The patterns, `{projectRoot}` still unreplaced
 */
export function selfInputs(root: string, project: ProjectRecord, target: string): string[] {
  const own = targetInputs(root, project, target).value.filter((input) => {
    if (typeof input === 'string') return !input.startsWith('^')
    if (input.fileset !== undefined) return input.dependencies !== true
    return input.dependencies !== true && (input.projects === undefined || input.projects === 'self')
  })
  return expandInputs(root, project, own)
}

/**
 * The file patterns a list of inputs stands for, named inputs expanded through the workspace's
 * and the project's definitions.
 *
 * @param root - The workspace root
 * @param project - The project whose named inputs apply
 * @param inputs - The inputs to expand
 * @returns The patterns, `{projectRoot}` still unreplaced
 */
export function expandInputs(root: string, project: ProjectRecord, inputs: readonly InputDefinition[]): string[] {
  const named: Readonly<Record<string, readonly InputDefinition[]>> = {
    default: ['{projectRoot}/**/*'],
    ...readNxConfiguration(root).namedInputs,
    ...(project.configuration?.namedInputs as Readonly<Record<string, readonly InputDefinition[]>> | undefined),
  }
  const patterns: string[] = []
  const expand = (inputs: readonly InputDefinition[], expanding: ReadonlySet<string>): void => {
    // why: a named input that names itself, directly or through another, would otherwise expand without end.
    const follow = (name: string): void => {
      if (!expanding.has(name)) expand(named[name] ?? [], createSet([...expanding, name]))
    }
    for (const input of inputs) {
      if (typeof input === 'string') {
        if (named[input] === undefined) patterns.push(input)
        else follow(input)
      } else if (input.fileset !== undefined) patterns.push(input.fileset)
      else if (input.input !== undefined) follow(input.input)
    }
  }
  expand(inputs, createSet())
  return patterns
}
