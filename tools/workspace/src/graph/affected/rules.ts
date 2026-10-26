/**
 * The reasons an affected decision is written with: one constructor per rule of the closed set,
 * each producing the sentence a reader sees, and the classification of the files whose change is
 * configuration rather than source.
 *
 * @module graph/affected/rules
 */

import type { ProjectRecord } from '../model'
import type { Reason, ReasonRule } from '../selection'
import { posix } from 'node:path'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ReasonRule as Rules } from '../selection'
import { GLOBAL_CONFIG } from '../store/meta'

/** What kind of configuration a changed file is. */
export const ConfigurationKind = freeze({
  /** The project's `package.json`. */
  Manifest: 'manifest',
  /** The project's `project.json`, a tsconfig, or its test or lint configuration. */
  Configuration: 'configuration',
} as const)

/** One of the configuration kinds. */
export type ConfigurationKind = (typeof ConfigurationKind)[keyof typeof ConfigurationKind]

/** The basenames of a project's own configuration files. */
const CONFIGURATION_FILES = freeze(['project.json', 'test.config.ts', 'lint.config.ts'] as const)

/**
 * Whether a file is one whose change invalidates the whole workspace.
 *
 * @param path - The path, workspace-relative
 * @returns True for `nx.json`, the root manifest, the lock file and the base tsconfig
 */
export function isGlobalConfig(path: string): boolean {
  return (GLOBAL_CONFIG as readonly string[]).includes(path)
}

/**
 * What kind of configuration of its project a file is, if any.
 *
 * @param path - The path, workspace-relative
 * @param project - The project owning it
 * @returns The kind, or null for a source, asset or documentation file
 */
export function configurationKind(path: string, project: ProjectRecord): ConfigurationKind | null {
  const relative = project.root === '.' ? path : path.slice(project.root.length + 1)
  if (relative.includes(posix.sep)) return null
  if (relative === 'package.json') return ConfigurationKind.Manifest
  if ((CONFIGURATION_FILES as readonly string[]).includes(relative) || (relative.startsWith('tsconfig') && relative.endsWith('.json')))
    return ConfigurationKind.Configuration
  return null
}

/**
 * A reason.
 *
 * @param rule - The rule that fired
 * @param file - The changed file the reason starts from, or null
 * @param path - The ids followed from the task's files to the changed file
 * @param message - One sentence for a reader
 * @returns The reason record
 */
export function reason(rule: ReasonRule, file: string | null, path: readonly string[], message: string): Reason {
  return { rule, file, path, message }
}

/**
 * The reason a changed global configuration file selects every task.
 *
 * @param file - The changed configuration file
 * @param task - The task selected
 * @returns The reason
 */
export function globalConfig(file: string, task: string): Reason {
  return reason(Rules.GlobalConfig, file, [], `${file} changed, which invalidates every task; ${task} runs`)
}

/**
 * The reason a task's own input changed.
 *
 * @param file - The changed file the task lists among its inputs
 * @param task - The task it is an input of
 * @param evidence - What named the file as an input
 * @returns The reason
 */
export function changedInput(file: string, task: string, evidence: string): Reason {
  return reason(Rules.ChangedInput, file, [], `${file} is an input of ${task} (${evidence})`)
}

/**
 * The reason a changed file of another project reached a task.
 *
 * @param rule - The rule under which it was reached
 * @param file - The changed file
 * @param task - The task whose closure holds the file
 * @param path - The ids followed
 * @param detail - What the rule rests on, appended to the sentence
 * @returns The reason
 */
export function reached(rule: ReasonRule, file: string, task: string, path: readonly string[], detail: string): Reason {
  return reason(rule, file, path, `${file} reaches ${task}: ${detail}`)
}

/**
 * The reason a task runs because a task it depends on runs.
 *
 * @param task - The task that runs after another
 * @param dependency - The task depended on, as `project:target`
 * @returns The reason
 */
export function dependentTask(task: string, dependency: string): Reason {
  return reason(Rules.DependentTask, null, [`task:${dependency}`], `${task} runs after ${dependency}, which is selected`)
}

/**
 * The reason a task was not selected for a changed file.
 *
 * @param rule - Which rule says the skip is safe
 * @param file - The changed file
 * @param task - The task left out
 * @param detail - Why the file does not reach the task
 * @returns The reason
 */
export function skipped(rule: ReasonRule, file: string, task: string, detail: string): Reason {
  return reason(rule, file, [], `${file} does not reach ${task}: ${detail}`)
}

/**
 * The record of a fallback that fired.
 *
 * @param rule - The fallback rule that fired
 * @param file - The file that drew the edge
 * @param path - The edge as `source → target`
 * @param detail - What happened
 * @returns The reason
 */
export function fallback(rule: ReasonRule, file: string, path: readonly string[], detail: string): Reason {
  return reason(rule, file, path, detail)
}
