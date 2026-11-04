'use client'

import type { Execution, ExecutionChain, ExecutionTask } from '@/lib/ci/execution'
import { formatClock, formatDuration } from '@/lib/ci/pipeline-view'
import { CATEGORY_LABEL, ENVIRONMENT_LABEL, STATE_LABEL, categoryOf } from '@/lib/ci/vocabulary'
import { ExternalLink, OsIcon, StateMark, TargetIcon } from './marks'

/** A task named by its id and environment, which together are unique in a run. */
export interface TaskRef {
  /** The task id */
  id: string
  /** The environment */
  environment: ExecutionTask['environment']
}

/** A task with its chain. */
export interface FoundTask {
  /** The task */
  task: ExecutionTask
  /** Its chain */
  chain: ExecutionChain
}

/**
 * The task and chain a reference names.
 * @param execution - The execution
 * @param ref - The reference, or null
 * @returns The task and its chain, or null
 */
export function findTask(execution: Execution, ref: TaskRef | null): FoundTask | null {
  if (ref === null) return null
  for (const chain of execution.chains) {
    if (chain.environment !== ref.environment) continue
    const task = chain.tasks.find((candidate) => candidate.id === ref.id)
    if (task !== undefined) return { task, chain }
  }
  return null
}

/** Props for {@link TaskDetail}. */
export interface TaskDetailProps {
  /** The execution */
  execution: Execution
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task, or none */
  onSelect: (ref: TaskRef | null) => void
}

/**
 * Everything known about the selected task: what it is, where it stands, when it ran, what it
 * needed first, why it was in the plan, and where its check run is.
 * @param props - See {@link TaskDetailProps}.
 * @param props.execution
 * @param props.selected
 * @param props.onSelect
 * @returns The panel, or a hint when nothing is selected
 */
export function TaskDetail({ execution, selected, onSelect }: TaskDetailProps) {
  const found = findTask(execution, selected)
  if (found === null) {
    return (
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Select a task on the timeline or in a project to read its details.</p>
    )
  }
  const { task, chain } = found
  const category = categoryOf(task.target)
  return (
    <section
      aria-label={`Task ${task.id}`}
      className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StateMark state={task.state} of={task.id} size={16} />
        <span className="font-mono font-semibold text-slate-900 dark:text-white">{task.id}</span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <TargetIcon category={category} />
          {CATEGORY_LABEL[category]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <OsIcon environment={task.environment} className="h-3 w-3" named />
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="ml-auto text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
          aria-label="Close the task details"
        >
          ✕
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
        <dt className="text-slate-500 dark:text-slate-400">State</dt>
        <dd>
          {STATE_LABEL[task.state]}
          {task.exitCode !== null && task.exitCode !== 0 ? ` (exit code ${task.exitCode})` : ''}
          {task.detail === null ? '' : ` · ${task.detail}`}
        </dd>
        {task.startedAt !== null ? (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Ran</dt>
            <dd>
              {formatClock(task.startedAt)}
              {task.endedAt === null ? '' : ` → ${formatClock(task.endedAt)}`}
              {task.durationMs === null ? '' : `, ${formatDuration(task.durationMs)}`}
              {execution.clock.start === null ? '' : ` · started ${formatDuration(task.startedAt - execution.clock.start)} into the run`}
              {task.target === 'publish' ? ' · a publish waits here for the Windows and macOS jobs before it runs' : ''}
            </dd>
          </>
        ) : null}
        <dt className="text-slate-500 dark:text-slate-400">Slot</dt>
        <dd>{task.weight === 'heavy' ? 'heavy: one of the two build slots' : 'light: one of the CPU-count slots'}</dd>
        <dt className="text-slate-500 dark:text-slate-400">After</dt>
        <dd>
          {task.needs.length === 0 ? (
            execution.plan?.truncated === true ? (
              'unknown: the live plan dropped its dependencies to fit'
            ) : (
              'nothing: it may start at once'
            )
          ) : (
            <ul className="flex flex-wrap gap-1">
              {task.needs.map((need) => {
                const needed = findTask(execution, { id: need, environment: task.environment })
                return (
                  <li key={need}>
                    <button
                      type="button"
                      onClick={() => onSelect({ id: need, environment: task.environment })}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 font-mono hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                    >
                      {needed === null ? null : <StateMark state={needed.task.state} size={11} />}
                      {need}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </dd>
        {task.reasons.length > 0 ? (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Why</dt>
            <dd>
              <ul className="space-y-0.5">
                {task.reasons.map((reason, index) => (
                  <li key={index}>
                    <span className="font-mono text-slate-500 dark:text-slate-400">{reason.rule}</span> {reason.message}
                    {reason.file === null ? '' : <span className="font-mono"> ({reason.file})</span>}
                  </li>
                ))}
                {task.reasonsOmitted === 0 ? null : (
                  <li className="text-slate-500 dark:text-slate-400">+{task.reasonsOmitted} more in the run&apos;s plan artifact</li>
                )}
              </ul>
            </dd>
          </>
        ) : null}
        {chain.url === null ? null : (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Check run</dt>
            <dd>
              <ExternalLink href={chain.url}>
                {chain.project} on {ENVIRONMENT_LABEL[chain.environment]}
              </ExternalLink>
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}
