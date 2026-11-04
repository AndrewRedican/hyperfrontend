'use client'

import type { Execution, ExecutionLane, ExecutionTask, StateCounts } from '@/lib/ci/execution'
import type { Environment } from '@/lib/ci/model'
import type { Category } from '@/lib/ci/vocabulary'
import { countStates } from '@/lib/ci/execution'
import { formatDuration } from '@/lib/ci/pipeline-view'
import { timelineLanes } from '@/lib/ci/timeline'
import { CATEGORIES, CATEGORY_LABEL, ENVIRONMENT_LABEL, STATE_GLYPH, STATE_LABEL, categoryOf } from '@/lib/ci/vocabulary'
import { useMemo } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { OsIcon, StateMark, TargetIcon, stateOfRun } from './marks'

/** Props for {@link MatrixView}. */
export interface MatrixViewProps {
  /** The execution */
  execution: Execution
}

/** One cell of the matrix: the tasks of one category on one runner. */
interface Cell {
  /** How many tasks */
  total: number
  /** How they stand */
  counts: StateCounts
}

/**
 * The matrix of an execution: for every category of target, how many tasks each runner ran and how they stand.
 * @param tasks - Every task
 * @returns The cells by category then environment, for the categories present
 */
function matrixOf(tasks: readonly ExecutionTask[]): [Category, Map<Environment, Cell>][] {
  const rows = createMap<Category, Map<Environment, Cell>>()
  for (const task of tasks) {
    const category = categoryOf(task.target)
    const row = rows.get(category) ?? createMap<Environment, Cell>()
    const cell = row.get(task.environment) ?? { total: 0, counts: countStates([]) }
    cell.total += 1
    cell.counts[task.state] += 1
    row.set(task.environment, cell)
    rows.set(category, row)
  }
  return CATEGORIES.filter((category) => rows.has(category)).map((category) => [category, rows.get(category) as Map<Environment, Cell>])
}

/**
 * A cell in a few characters: the count, and the glyphs of the states that are not success.
 * @param cell - The cell
 * @returns `21` or `20 ✕1`
 */
function describeCell(cell: Cell): string {
  const others = (['failure', 'skipped', 'cancelled', 'ready', 'blocked', 'queued', 'unknown'] as const)
    .filter((state) => cell.counts[state] > 0)
    .map((state) => `${STATE_GLYPH[state]}${cell.counts[state]}`)
  return others.length === 0 ? `${cell.total}` : `${cell.counts.success} ${others.join(' ')}`
}

/**
 * A cell in words.
 * @param cell - The cell
 * @returns `21 tasks: 20 succeeded, 1 failed`
 */
function wordCell(cell: Cell): string {
  const parts = (['success', 'failure', 'skipped', 'cancelled', 'ready', 'blocked', 'queued', 'unknown'] as const)
    .filter((state) => cell.counts[state] > 0)
    .map((state) => `${cell.counts[state]} ${STATE_LABEL[state]}`)
  return `${cell.total} task${cell.total === 1 ? '' : 's'}: ${parts.join(', ')}`
}

/** Props for {@link LaneCard}. */
interface LaneCardProps {
  /** The lane */
  lane: ExecutionLane
  /** How many chains */
  chains: number
  /** How many tasks */
  tasks: number
  /** The most tasks at once */
  peak: number
  /** When the run started, or null */
  start: number | null
}

/**
 * One runner as a card of the flow.
 * @param props - See {@link LaneCardProps}.
 * @param props.lane
 * @param props.chains
 * @param props.tasks
 * @param props.peak
 * @param props.start
 * @returns The card
 */
function LaneCard({ lane, chains, tasks, peak, start }: LaneCardProps) {
  const duration = lane.startedAt !== null && lane.endedAt !== null ? lane.endedAt - lane.startedAt : null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
        <StateMark
          state={stateOfRun(lane.status, lane.complete ? lane.conclusion : lane.status === 'completed' ? 'incomplete' : null)}
          of={`${ENVIRONMENT_LABEL[lane.environment]} job`}
          size={12}
        />
        <OsIcon environment={lane.environment} className="h-3.5 w-3.5" named />
      </p>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {chains} chains · {tasks} tasks
        {peak > 0 ? ` · up to ${peak} at once` : ''}
      </p>
      <p className="text-slate-600 dark:text-slate-400">
        {duration === null ? (lane.status === 'queued' ? 'not started' : 'running') : formatDuration(duration)}
        {start !== null && lane.startedAt !== null ? ` · from +${formatDuration(lane.startedAt - start)}` : ''}
      </p>
    </div>
  )
}

/**
 * The run as its dynamic matrix: the flow from the plan job into the three runners and on to
 * the publishes and the record, then a grid of what each runner ran per category of target.
 * @param props - See {@link MatrixViewProps}.
 * @param props.execution
 * @returns The view
 */
export function MatrixView({ execution }: MatrixViewProps) {
  const tasks = useMemo(() => execution.chains.flatMap((chain) => [...chain.tasks]), [execution])
  const lanes = useMemo(() => timelineLanes(execution), [execution])
  const environments = execution.lanes.map((lane) => lane.environment)
  const matrix = useMemo(() => matrixOf(tasks), [tasks])
  const plan = execution.stages.find((stage) => stage.name === 'plan') ?? null
  const records = execution.stages.find((stage) => stage.name === 'records') ?? null
  const publishes = tasks.filter((task) => task.target === 'publish')
  const main = execution.plan?.main === true
  const arrow = (
    <span aria-hidden="true" className="self-center text-slate-400 lg:rotate-0">
      →
    </span>
  )
  return (
    <div className="ci-explorer mt-3 text-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs lg:w-44 dark:border-slate-700 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
            {plan === null ? null : <StateMark state={stateOfRun(plan.status, plan.conclusion)} of="plan job" size={12} />}
            plan
          </p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {execution.plan === null
                ? 'selects the tasks the change reaches'
                : execution.plan.mode === 'all'
                  ? 'every task of every project'
                  : `the tasks the change reaches; ${execution.plan.skipped} left out with a reason`}
            </p>
            {plan?.startedAt !== null && plan?.startedAt !== undefined && plan.endedAt !== null ? (
              <p className="text-slate-600 dark:text-slate-400">{formatDuration(plan.endedAt - plan.startedAt)} on one Linux runner</p>
            ) : null}
          </div>
        </div>
        {arrow}
        <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {lanes.map((lane) => (
            <LaneCard
              key={lane.lane.environment}
              lane={lane.lane}
              chains={lane.chains.length}
              tasks={lane.chains.reduce((count, row) => count + row.bars.length + row.unrun.length, 0)}
              peak={lane.peak}
              start={execution.clock.start}
            />
          ))}
        </div>
        {main ? (
          <>
            {arrow}
            <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs lg:w-44 dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-900 dark:text-white">publish</p>
              <p className="my-auto pt-1 text-slate-600 dark:text-slate-400">
                {publishes.length} publish{publishes.length === 1 ? '' : 'es'} inside the Linux job, each waiting for the Windows and macOS
                jobs to conclude, then for the publishes of the packages it depends on
              </p>
            </div>
            {arrow}
            <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs lg:w-40 dark:border-slate-700 dark:bg-slate-900">
              <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                {records === null ? null : <StateMark state={stateOfRun(records.status, records.conclusion)} of="records job" size={12} />}
                record
              </p>
              <p className="my-auto pt-1 text-slate-600 dark:text-slate-400">
                the plan and every runner&apos;s results, pushed to the records branch this page reads
              </p>
            </div>
          </>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        The three runners start together, each on its own machine, and each serves its chains in rank order: a task starts the moment every
        task it needs has succeeded and a slot of its weight is free, with as many light tasks at once as the runner has CPUs and at most
        two library builds. Windows and macOS take the typecheck, lint, test, build and end-to-end tasks of the libraries and tools the
        change reaches; Linux alone installs, builds and verifies the apps and demos, probes the built packages, publishes, provisions and
        deploys. A task behind a failed prerequisite is skipped.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Tasks per category of target and runner</caption>
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                target
              </th>
              {environments.map((environment) => (
                <th key={environment} scope="col" className="px-2 py-1 text-right font-medium">
                  <OsIcon environment={environment} className="h-3 w-3" named />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(([category, cells]) => (
              <tr key={category} className="border-t border-slate-200 dark:border-slate-700">
                <th
                  scope="row"
                  className="py-1 pr-3 text-left font-normal text-slate-800 dark:text-slate-200"
                  title={CATEGORY_LABEL[category]}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <TargetIcon category={category} className="h-3.5 w-3.5 text-slate-500" />
                    {category}
                  </span>
                </th>
                {environments.map((environment) => {
                  const cell = cells.get(environment)
                  return (
                    <td
                      key={environment}
                      className="px-2 py-1 text-right tabular-nums text-slate-700 dark:text-slate-300"
                      title={cell === undefined ? `no ${category} task on ${ENVIRONMENT_LABEL[environment]} in this run` : wordCell(cell)}
                    >
                      {cell === undefined ? <span className="text-slate-300 dark:text-slate-600">–</span> : describeCell(cell)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
