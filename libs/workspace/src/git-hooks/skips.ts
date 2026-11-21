/**
 * Why a step does not run: every hook was switched off for the invocation, the command line or
 * the environment named the step, or this clone's local file does. A skip always has a source a
 * reader can be shown.
 *
 * @module git-hooks/skips
 */

import type { HooksConfig, HookName, LocalHooksConfig } from './config'
import { stepNames } from './config'
import { LOCAL_HOOKS_CONFIG } from './load'

/** The variable that switches every hook off when it holds `0`. */
export const HOOKS_VARIABLE = 'HF_HOOKS'

/** The variable naming the steps one invocation skips, separated by commas. */
export const SKIP_VARIABLE = 'HF_HOOKS_SKIP'

/** Everything that can keep a step from running. */
export interface SkipSources {
  /** The environment the hook runs in. */
  readonly env: Readonly<Record<string, string | undefined>>
  /** This clone's preferences. */
  readonly local: LocalHooksConfig
  /** The steps `--only` names; none runs every step. */
  readonly only: readonly string[]
  /** The steps `--skip` names. */
  readonly skip: readonly string[]
}

/**
 * The names a comma-separated value holds.
 *
 * @param value - The value of a flag or a variable, if any
 * @returns The names, none for an absent or empty value
 *
 * @example Reading the steps one push skips
 * ```typescript
 * import { namesOf } from '@hyperfrontend/workspace/git-hooks'
 *
 * namesOf('pipeline, audit') // => ['pipeline', 'audit']
 * namesOf(undefined) // => []
 * ```
 */
export function namesOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/**
 * The lists of names that skip steps, each with the source a reader is shown.
 *
 * @param sources - The flags, the environment and the local file
 * @returns The source and its names, in the order they are consulted
 */
function skipLists(sources: SkipSources): [string, readonly string[]][] {
  return [
    ['--skip', sources.skip],
    [SKIP_VARIABLE, namesOf(sources.env[SKIP_VARIABLE])],
    [LOCAL_HOOKS_CONFIG, sources.local.skip ?? []],
  ]
}

/**
 * Why a step is skipped, if it is.
 *
 * @param hook - The hook the step belongs to
 * @param step - The step's name
 * @param sources - The flags, the environment and the local file
 * @returns What skipped the step, or null when it runs
 *
 * @example A step this clone's local file names
 * ```typescript
 * import { skipReason } from '@hyperfrontend/workspace/git-hooks'
 *
 * const sources = { env: process.env, local: { skip: ['pipeline'] }, only: [], skip: [] }
 * skipReason('pre-push', 'pipeline', sources) // => 'hooks.local.config.ts'
 * skipReason('pre-push', 'audit', sources) // => null
 * ```
 */
export function skipReason(hook: HookName, step: string, sources: SkipSources): string | null {
  const names = (list: readonly string[]): boolean => list.includes(step) || list.includes(`${hook}:${step}`)
  if (sources.env[HOOKS_VARIABLE] === '0') return `${HOOKS_VARIABLE}=0`
  if (sources.only.length > 0 && !names(sources.only)) return '--only'
  return skipLists(sources).find(([, list]) => names(list))?.[0] ?? null
}

/**
 * The names that were meant to select or skip a step and match none, so a misspelt skip is said
 * rather than silently ignored.
 *
 * @param config - The hooks
 * @param sources - The flags, the environment and the local file
 * @returns One line per source that names a step no hook has
 *
 * @example A skip that names nothing
 * ```typescript
 * import { unknownSkips } from '@hyperfrontend/workspace/git-hooks'
 *
 * const config = { 'pre-push': [{ name: 'pipeline', run: ['hf', 'affected', '-t', 'test'] }] }
 * unknownSkips(config, { env: { HF_HOOKS_SKIP: 'pipline' }, local: {}, only: [], skip: [] })
 * // => ['HF_HOOKS_SKIP names no step: pipline']
 * ```
 */
export function unknownSkips(config: HooksConfig, sources: SkipSources): string[] {
  const known = stepNames(config)
  return [['--only', sources.only] as [string, readonly string[]], ...skipLists(sources)].flatMap(([source, list]) => {
    const unknown = list.filter((name) => !known.has(name))
    return unknown.length === 0 ? [] : [`${source} names no step: ${unknown.join(', ')}`]
  })
}
