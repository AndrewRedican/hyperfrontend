/**
 * The scheduler: runs a task the moment every task it needs has succeeded and a slot of its
 * weight is free, serves the ready tasks by their chain's rank, skips the dependents of a
 * failure, keeps everything independent running, and records when each task started and ended.
 *
 * @module pipeline/schedule
 */

import type { RunOutcome } from './execute'
import type { Outcome as OutcomeKind, Weight } from './model'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { promiseRace } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from '../graph/order'
import { Outcome, PipelineRule, Weight as Weights } from './model'

/** What the scheduler reads off a task. */
export interface ScheduleTask {
  /** The id. */
  readonly id: string
  /** The ids that must succeed first. */
  readonly needs: readonly string[]
  /** The slot the task occupies. */
  readonly weight: Weight
  /** The rank the task is served in among the ready; lower first. */
  readonly order: number
}

/** What one task ended as, with its timing. */
export interface ScheduleResult {
  /** The id. */
  readonly id: string
  /** What happened. */
  readonly outcome: OutcomeKind
  /** The exit code, or null. */
  readonly exitCode: number | null
  /** Why the task was skipped or cancelled, or what kept it from an exit, or null. */
  readonly detail: string | null
  /** When the task started, or null when it did not. */
  readonly startedAt: number | null
  /** When the task ended, or null when it did not start. */
  readonly endedAt: number | null
  /** How long the task ran. */
  readonly durationMs: number
  /** The log file, or null. */
  readonly log: string | null
}

/** What a schedule needs. */
export interface ScheduleOptions<Task extends ScheduleTask> {
  /** The tasks of one environment. */
  readonly tasks: readonly Task[]
  /** How many light tasks run at once. */
  readonly parallel: number
  /** How many heavy tasks run at once. */
  readonly heavy: number
  /** Runs one task; never rejects. */
  readonly run: (task: Task) => Promise<RunOutcome>
  /** Cancels what has not started. */
  readonly signal?: AbortSignal
  /** The clock. */
  readonly now?: () => number
  /** Called as a task starts. */
  readonly onStart?: (task: Task) => void
  /** Called as a task ends, is skipped or is cancelled. */
  readonly onEnd?: (task: Task, result: ScheduleResult) => void
}

/**
 * Checks that every need names a task of the schedule, that no task needs itself through others,
 * and that each budget admits at least one task.
 *
 * @param options - The tasks and the budgets
 * @throws {Error} Naming the first unknown need, the cycle, or the empty budget
 */
export function validateSchedule<Task extends ScheduleTask>(options: ScheduleOptions<Task>): void {
  if (options.parallel < 1 || options.heavy < 1) throw createError('the schedule needs at least one light and one heavy slot')
  const ids = createSet(options.tasks.map((task) => task.id))
  for (const task of options.tasks) {
    for (const need of task.needs) if (!ids.has(need)) throw createError(`${task.id} needs ${need}, which is not in the schedule`)
  }
  const byId = createMap(options.tasks.map((task) => [task.id, task] as const))
  const done = createSet<string>()
  const visit = (id: string, trail: readonly string[]): void => {
    if (done.has(id)) return
    if (trail.includes(id)) throw createError(`the schedule has a cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' → ')}`)
    for (const need of (byId.get(id) as Task).needs) visit(need, [...trail, id])
    done.add(id)
  }
  for (const task of options.tasks) visit(task.id, [])
}

/**
 * A result for a task that never ran.
 *
 * @param id - The task id
 * @param outcome - Skipped or cancelled
 * @param detail - Why
 * @returns The result
 */
function unrun(id: string, outcome: OutcomeKind, detail: string): ScheduleResult {
  return { id, outcome, exitCode: null, detail, startedAt: null, endedAt: null, durationMs: 0, log: null }
}

/**
 * Runs a schedule to completion.
 *
 * @param options - The tasks, the budgets, the runner and the hooks
 * @returns Every task's result, by id
 */
export async function runSchedule<Task extends ScheduleTask>(options: ScheduleOptions<Task>): Promise<Map<string, ScheduleResult>> {
  validateSchedule(options)
  const now = options.now ?? dateNow
  const results = createMap<string, ScheduleResult>()
  const pending = createMap(options.tasks.map((task) => [task.id, task] as const))
  const running = createMap<string, Promise<void>>()
  const slots = { [Weights.Light]: 0, [Weights.Heavy]: 0 }
  const limits = { [Weights.Light]: options.parallel, [Weights.Heavy]: options.heavy }
  const finish = (task: Task, result: ScheduleResult): void => {
    results.set(task.id, result)
    options.onEnd?.(task, result)
  }
  const start = (task: Task): void => {
    pending.delete(task.id)
    slots[task.weight] += 1
    const startedAt = now()
    options.onStart?.(task)
    running.set(
      task.id,
      options.run(task).then((outcome) => {
        slots[task.weight] -= 1
        running.delete(task.id)
        const endedAt = now()
        finish(task, {
          id: task.id,
          outcome: outcome.outcome,
          exitCode: outcome.exitCode,
          detail: outcome.detail,
          startedAt,
          endedAt,
          durationMs: endedAt - startedAt,
          log: outcome.log,
        })
      })
    )
  }
  while (pending.size > 0 || running.size > 0) {
    for (const task of [...pending.values()]) {
      if (options.signal?.aborted === true) {
        pending.delete(task.id)
        finish(task, unrun(task.id, Outcome.Cancelled, `${PipelineRule.Cancelled}: the run was interrupted before the task started`))
        continue
      }
      const failed = task.needs.find((need) => results.has(need) && results.get(need)?.outcome !== Outcome.Success)
      if (failed !== undefined) {
        pending.delete(task.id)
        finish(task, unrun(task.id, Outcome.Skipped, `${PipelineRule.PrerequisiteFailed}: ${failed}`))
      }
    }
    const ready = [...pending.values()]
      .filter((task) => task.needs.every((need) => results.get(need)?.outcome === Outcome.Success))
      .sort((left, right) => left.order - right.order || compareText(left.id, right.id))
    for (const task of ready) if (slots[task.weight] < limits[task.weight]) start(task)
    if (running.size === 0) break
    await promiseRace([...running.values()])
  }
  return results
}
