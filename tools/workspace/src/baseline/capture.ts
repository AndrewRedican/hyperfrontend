/**
 * Captures Nx's own selection for a revision range: the affected projects and the task-level
 * selection with its reasons, parsed from the JSON forms the Nx commands write.
 *
 * @module baseline/capture
 */

import type { BaselineSelection, NxExplanation } from './model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { compareText } from '../graph/model'

/** Runs one Nx command and returns its standard output. */
export type NxRunner = (args: readonly string[]) => string

/** What a capture needs. */
export interface CaptureOptions {
  /** The base revision. */
  readonly base: string
  /** The head revision. */
  readonly head: string
  /** The targets whose task selection is captured. */
  readonly targets: readonly string[]
  /** Runs Nx in the checkout being captured. */
  readonly run: NxRunner
}

/** The targets the pipeline selects work for. */
export const DEFAULT_TARGETS = freeze(['build', 'test', 'typecheck', 'lint', 'e2e'] as const)

/** The keys an explanation carries. */
const EXPLANATION_KEYS = freeze(['affected', 'upstream', 'touched', 'requested'] as const)

/**
 * Captures Nx's selection between two revisions.
 *
 * @param options - The revisions, the targets and the runner
 * @returns The projects and the task-level explanation
 */
export function captureBaseline(options: CaptureOptions): BaselineSelection {
  const range = [`--base=${options.base}`, `--head=${options.head}`]
  const projects = parseAffectedProjects(options.run(['show', 'projects', '--affected', '--json', ...range]))
  const explanation = parseExplanation(options.run(['affected', '-t', options.targets.join(','), '--explain=stdout', ...range]))
  return { base: options.base, head: options.head, projects, explanation }
}

/**
 * Parses the output of `nx show projects --affected --json`.
 *
 * @param text - The command's standard output
 * @returns The project names, sorted
 */
export function parseAffectedProjects(text: string): string[] {
  const value: unknown = parse(text)
  if (!isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw createError('nx show projects --affected --json did not print a list of project names')
  }
  return [...(value as string[])].sort(compareText)
}

/**
 * Parses the output of `nx affected --explain=stdout`.
 *
 * @param text - The command's standard output
 * @returns The explanation as Nx wrote it
 */
export function parseExplanation(text: string): NxExplanation {
  const value: unknown = parse(text)
  if (typeof value !== 'object' || value === null || isArray(value)) {
    throw createError('nx affected --explain=stdout did not print an explanation object')
  }
  const missing = EXPLANATION_KEYS.filter((key) => !keys(value).includes(key))
  if (missing.length > 0) throw createError(`nx affected --explain=stdout printed an explanation without ${missing.join(', ')}`)
  return value as NxExplanation
}

/**
 * The affected tasks of one target, from an explanation covering several.
 *
 * @param explanation - Nx's explanation over one or more targets
 * @param target - The target whose tasks are wanted
 * @returns The task ids, sorted
 */
export function affectedTasks(explanation: NxExplanation, target: string): string[] {
  return keys(explanation.affected)
    .filter((task) => task.slice(task.indexOf(':') + 1) === target)
    .sort(compareText)
}
