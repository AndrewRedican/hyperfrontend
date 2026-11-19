/**
 * The matrix a run ends on: one row per project, one column per target, one mark per cell saying
 * how the tasks of that project and target ended.
 *
 * @module progress/matrix
 */

import type { Terminal } from './terminal'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from '../graph/order'
import { Style } from './terminal'

/** How a task ended, as a reader is shown it. */
export const Ending = freeze({
  /** It ran and succeeded. */
  Passed: 'passed',
  /** It ran and did not succeed. */
  Failed: 'failed',
  /** It did not run because a task it needs did not succeed. */
  Skipped: 'skipped',
  /** It did not run because the run ended before its turn. */
  NotRun: 'not-run',
} as const)

/** One of the endings. */
export type Ending = (typeof Ending)[keyof typeof Ending]

/** One task of the matrix. */
export interface MatrixTask {
  /** The row: the project. */
  readonly project: string
  /** The column: the target. */
  readonly target: string
  /** The stage the task ran in, counted from 0; the columns follow the stages. */
  readonly stage: number
  /** How the task ended. */
  readonly ending: Ending
}

/** The mark and the style of each ending. */
const MARKS: Readonly<Record<Ending, readonly [string, Style]>> = freeze({
  [Ending.Passed]: ['✓', Style.Green],
  [Ending.Failed]: ['✗', Style.Red],
  [Ending.Skipped]: ['-', Style.Yellow],
  [Ending.NotRun]: ['·', Style.Dim],
})

/** The endings in the order a reader is told of them: in the legend and in the totals. */
export const ENDINGS: readonly Ending[] = freeze([Ending.Passed, Ending.Failed, Ending.Skipped, Ending.NotRun])

/** The endings from the gravest: a cell holding several tasks shows the first of these among them. */
const GRAVEST_FIRST: readonly Ending[] = freeze([Ending.Failed, Ending.Skipped, Ending.NotRun, Ending.Passed])

/**
 * The mark of an ending, in its style.
 *
 * @param ending - How a task ended
 * @param paint - Sets text apart in a style
 * @returns The mark, painted
 *
 * @example The same marks lead a task's line and fill the matrix
 * ```typescript
 * import { createTerminal, Ending, markOf } from '@hyperfrontend/workspace/progress'
 *
 * markOf(Ending.Failed, createTerminal(process.stderr, process.env).paint) // => '✗', red on a terminal
 * ```
 */
export function markOf(ending: Ending, paint: Terminal['paint']): string {
  const [mark, style] = MARKS[ending]
  return paint(mark, style)
}

/**
 * The lines of the matrix: the targets as a heading in the order of their stages, a row per
 * project by name, and the legend of the marks.
 *
 * @param tasks - Every task of the run with how it ended
 * @param paint - Sets text apart in a style
 * @returns The heading, a row per project, and the legend
 *
 * @example A failed type check that kept the build from running
 * ```typescript
 * import { createTerminal, Ending, matrixLines } from '@hyperfrontend/workspace/progress'
 *
 * matrixLines(
 *   [
 *     { project: 'lib-core', target: 'typecheck', stage: 0, ending: Ending.Failed },
 *     { project: 'lib-core', target: 'build', stage: 1, ending: Ending.NotRun },
 *     { project: 'lib-util', target: 'typecheck', stage: 0, ending: Ending.Passed },
 *   ],
 *   createTerminal(process.stderr, process.env).paint
 * )
 * // => [
 * //   '          typecheck  build',
 * //   'lib-core  ✗          ·',
 * //   'lib-util  ✓',
 * //   '✓ passed  ✗ failed  - skipped  · not run',
 * // ]
 * ```
 */
export function matrixLines(tasks: readonly MatrixTask[], paint: Terminal['paint']): string[] {
  const stageOf = (target: string): number => (tasks.find((task) => task.target === target) as MatrixTask).stage
  const targets = [...createSet(tasks.map((task) => task.target))].sort((left, right) => stageOf(left) - stageOf(right))
  const projects = [...createSet(tasks.map((task) => task.project))].sort(compareText)
  const width = max(0, ...projects.map((project) => project.length))
  const cell = (project: string, target: string): string => {
    const endings = tasks.filter((task) => task.project === project && task.target === target).map((task) => task.ending)
    const shown = GRAVEST_FIRST.find((ending) => endings.includes(ending))
    return shown === undefined ? ' '.repeat(target.length) : `${markOf(shown, paint)}${' '.repeat(target.length - 1)}`
  }
  return [
    `${' '.repeat(width)}  ${targets.join('  ')}`,
    ...projects.map((project) => `${project.padEnd(width)}  ${targets.map((target) => cell(project, target)).join('  ')}`.trimEnd()),
    ENDINGS.map((ending) => `${markOf(ending, paint)} ${ending.replace('-', ' ')}`).join('  '),
  ]
}
