/**
 * What `hooks.config.ts` and `hooks.local.config.ts` hold: per hook, the named steps that run in
 * order, and per clone, the steps it does not run. Both are checked when they are defined and
 * again when they are loaded, so a file written without the helpers is read the same way.
 *
 * @module git-hooks/config
 */

import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries, freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { refusal } from '../runner/refusal'

/** The Git hooks a workspace configures, in the order a commit and a push reach them. */
export const GIT_HOOKS = freeze(['pre-commit', 'commit-msg', 'pre-push'] as const)

/** One of the Git hooks. */
export type GitHook = (typeof GIT_HOOKS)[number]

/** The name the steps of `hf push` go by: they run before the push, outside any Git hook. */
export const PUSH_STEPS = 'push'

/** A list of steps a configuration names: a Git hook, or the steps `hf push` runs first. */
export type HookName = GitHook | typeof PUSH_STEPS

/** One step of a hook. */
export interface HookStep {
  /** The name the step is listed, skipped and selected by: letters, digits, `.`, `_` and `-`. */
  readonly name: string
  /**
   * The program and its arguments, started without a shell from the workspace root. `hf` is this
   * command line and `node` the running Node.js; any other program is found on the search path,
   * the workspace's `node_modules/.bin` first.
   */
  readonly run: readonly string[]
  /** Variables set for the step, over the environment the hook runs in. */
  readonly env?: Readonly<Record<string, string>>
  /** What is printed when the step fails. */
  readonly failText?: string
  /** Whether the files that were fully staged before the step, and that it changed, are staged again after it. */
  readonly stageFixed?: boolean
  /** Whether the arguments Git gave the hook follow the step's own. */
  readonly passArgs?: boolean
}

/** A workspace's hooks: the steps of each, in the order they run. */
export type HooksConfig = { readonly [Hook in HookName]?: readonly HookStep[] }

/** What one clone changes about the workspace's hooks. */
export interface LocalHooksConfig {
  /** The steps this clone does not run: a step's name, or `<hook>:<step>` for the step of one hook. */
  readonly skip?: readonly string[]
}

/** The lists of steps a configuration may hold. */
const HOOK_NAMES: readonly string[] = [...GIT_HOOKS, PUSH_STEPS]

/** What a step may hold. */
const STEP_FIELDS = ['name', 'run', 'env', 'failText', 'stageFixed', 'passArgs']

/** The names a step may go by. */
const STEP_NAME = /^[A-Za-z0-9][\w.-]*$/

/**
 * Whether a value is a list of texts.
 *
 * @param value - What a field holds
 * @returns True for an array holding strings alone
 */
function isTexts(value: unknown): value is string[] {
  return isArray(value) && value.every((item) => typeof item === 'string')
}

/**
 * Whether a value is an object with fields, as against a list or nothing.
 *
 * @param value - What a file exports or a list holds
 * @returns True for a non-null object that is not an array
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Refuses a step that could not run or be named.
 *
 * @param hook - The hook holding the step
 * @param step - What the list holds at the step's place
 * @returns The step's name
 * @throws {Error} A refusal saying which field is wrong
 */
function checkedStep(hook: string, step: unknown): string {
  if (!isRecord(step) || typeof step['name'] !== 'string' || !STEP_NAME.test(step['name'])) {
    throw refusal(`${hook}: every step needs a name of letters, digits, ".", "_" and "-"`)
  }
  const at = `${hook}: step ${step['name']}`
  const unknown = entries(step).find(([field]) => !STEP_FIELDS.includes(field))
  if (unknown !== undefined) throw refusal(`${at} has no field ${unknown[0]}; a step takes ${STEP_FIELDS.join(', ')}`)
  if (!isTexts(step['run']) || step['run'].length === 0 || step['run'][0] === '') {
    throw refusal(`${at} needs run, the program and its arguments as an array of strings`)
  }
  if (step['env'] !== undefined && !(isRecord(step['env']) && isTexts(entries(step['env']).map(([, value]) => value)))) {
    throw refusal(`${at}: env holds variables as strings`)
  }
  if (step['failText'] !== undefined && typeof step['failText'] !== 'string') throw refusal(`${at}: failText is a string`)
  for (const flag of ['stageFixed', 'passArgs']) {
    if (step[flag] !== undefined && typeof step[flag] !== 'boolean') throw refusal(`${at}: ${flag} is true or false`)
  }
  return step['name']
}

/**
 * Reads a value as a hooks configuration.
 *
 * @param value - What `hooks.config.ts` exports
 * @returns The configuration
 * @throws {Error} A refusal naming the hook it does not know, or the step that could not run or share its name
 *
 * @example Reading what a configuration file exports
 * ```typescript
 * import { checkHooks } from '@hyperfrontend/workspace/git-hooks'
 *
 * checkHooks({ 'pre-push': [{ name: 'lint', run: ['hf', 'affected', '-t', 'lint'] }] }) // => the same object
 * checkHooks({ 'post-merge': [] }) // throws: post-merge is not a hook this configures; the hooks are pre-commit, commit-msg, pre-push, push
 * ```
 */
export function checkHooks(value: unknown): HooksConfig {
  if (!isRecord(value)) throw refusal('the hooks are an object with a list of steps per hook')
  for (const [hook, steps] of entries(value)) {
    if (!HOOK_NAMES.includes(hook)) throw refusal(`${hook} is not a hook this configures; the hooks are ${HOOK_NAMES.join(', ')}`)
    if (!isArray(steps)) throw refusal(`${hook} takes a list of steps`)
    const names = steps.map((step) => checkedStep(hook, step))
    const repeated = names.find((name, index) => names.indexOf(name) !== index)
    if (repeated !== undefined) throw refusal(`${hook} names the step ${repeated} twice`)
  }
  return value as HooksConfig
}

/**
 * Reads a value as one clone's preferences.
 *
 * @param value - What `hooks.local.config.ts` exports
 * @returns The preferences
 * @throws {Error} A refusal when `skip` is not a list of names
 *
 * @example Reading what a local file exports
 * ```typescript
 * import { checkLocalHooks } from '@hyperfrontend/workspace/git-hooks'
 *
 * checkLocalHooks({ skip: ['pipeline', 'pre-commit:format'] }) // => the same object
 * checkLocalHooks({ skip: 'pipeline' }) // throws: skip takes a list of step names
 * ```
 */
export function checkLocalHooks(value: unknown): LocalHooksConfig {
  if (!isRecord(value)) throw refusal('the local hooks are an object')
  if (value['skip'] !== undefined && !isTexts(value['skip'])) throw refusal('skip takes a list of step names')
  return value as LocalHooksConfig
}

/**
 * Declares the hooks of a workspace, in `hooks.config.ts` at its root. Each hook is a list of
 * named steps that run in order; the first that fails ends the hook.
 *
 * @param config - The steps of each hook
 * @returns The configuration, checked
 * @throws {Error} A refusal naming the hook it does not know, or the step that could not run or share its name
 *
 * @example Formatting what is committed and checking what is pushed
 * ```typescript
 * import { defineHooks } from '@hyperfrontend/workspace/git-hooks'
 *
 * export default defineHooks({
 *   'pre-commit': [{ name: 'format', run: ['hf', 'format', '--write'], stageFixed: true }],
 *   'pre-push': [
 *     {
 *       name: 'checks',
 *       run: ['hf', 'affected', '-t', 'typecheck,lint', '-t', 'test'],
 *       failText: 'A check failed. Each task wrote its log under .hf/logs.',
 *     },
 *   ],
 * })
 * ```
 */
export function defineHooks(config: HooksConfig): HooksConfig {
  return checkHooks(config)
}

/**
 * Declares what one clone changes about the workspace's hooks, in an untracked
 * `hooks.local.config.ts` beside the configuration.
 *
 * @param config - The steps this clone does not run
 * @returns The preferences, checked
 * @throws {Error} A refusal when `skip` is not a list of names
 *
 * @example A clone that leaves the long step to the pull request
 * ```typescript
 * import { defineLocalHooks } from '@hyperfrontend/workspace/git-hooks'
 *
 * export default defineLocalHooks({ skip: ['pipeline'] })
 * ```
 */
export function defineLocalHooks(config: LocalHooksConfig): LocalHooksConfig {
  return checkLocalHooks(config)
}

/**
 * The names of every step a configuration holds, plain and qualified by hook.
 *
 * @param config - The hooks
 * @returns Each step as `<step>` and as `<hook>:<step>`
 *
 * @example Telling a skip that names nothing from one that names a step
 * ```typescript
 * import { stepNames } from '@hyperfrontend/workspace/git-hooks'
 *
 * stepNames({ 'pre-push': [{ name: 'audit', run: ['hf', 'run-many', '-t', 'audit', '--all'] }] }).has('pre-push:audit') // => true
 * ```
 */
export function stepNames(config: HooksConfig): ReadonlySet<string> {
  return createSet(
    entries(config).flatMap(([hook, steps]) => (steps as readonly HookStep[]).flatMap((step) => [step.name, `${hook}:${step.name}`]))
  )
}
