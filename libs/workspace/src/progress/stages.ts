/**
 * The stages of a run: an ordered list of target groups, run one group after another. Every task
 * belongs to the first stage that names its target, a prerequisite to the earliest stage that
 * needs it, and a stage that did not succeed whole ends the run before the next one starts.
 * Nothing here knows how a task is executed.
 *
 * @module progress/stages
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** What staging reads off a task. */
export interface StagedTask {
  /** `<project>:<target>`. */
  readonly id: string
  /** The target. */
  readonly target: string
  /** The ids of the tasks it runs after. */
  readonly needs: readonly string[]
}

/** How a staged run ended. */
export interface StagedRun {
  /** The stage that did not succeed and ended the run, counted from 0, or null when every stage ran. */
  readonly stopped: number | null
  /** The ids of the tasks of the stages that never started, in the order given. */
  readonly notRun: readonly string[]
}

/** A task as far as a staged run names it. */
export interface Identified {
  /** `<project>:<target>`. */
  readonly id: string
}

/** What a staged run needs. */
export interface StagedOptions<Task extends Identified> {
  /** The tasks, in the order they run inside a stage. */
  readonly tasks: readonly Task[]
  /** The stage of each task, by id, counted from 0. */
  readonly stageOf: ReadonlyMap<string, number>
  /** Runs the tasks of one stage to the end and resolves to whether every one of them succeeded. */
  readonly runStage: (tasks: readonly Task[], stage: number) => Promise<boolean>
}

/**
 * The stage of every task: the first stage naming its target, or the last stage for a target no
 * stage names; then every prerequisite moves to the earliest stage holding a task that needs it.
 *
 * @param tasks - The tasks, each with its target and the tasks it runs after
 * @param stages - The target groups, in the order they run
 * @returns The stage of each task by id, counted from 0
 *
 * @example A build one test needs runs with the tests, the other builds after them
 * ```typescript
 * import { assignStages } from '@hyperfrontend/workspace/progress'
 *
 * assignStages(
 *   [
 *     { id: 'lib-core:build', target: 'build', needs: [] },
 *     { id: 'lib-core:test', target: 'test', needs: ['lib-core:build'] },
 *     { id: 'lib-util:lint', target: 'lint', needs: [] },
 *     { id: 'lib-util:build', target: 'build', needs: [] },
 *   ],
 *   [['typecheck', 'lint'], ['test'], ['build']]
 * )
 * // => Map { 'lib-core:build' => 1, 'lib-core:test' => 1, 'lib-util:lint' => 0, 'lib-util:build' => 2 }
 * ```
 */
export function assignStages(tasks: readonly StagedTask[], stages: readonly (readonly string[])[]): Map<string, number> {
  const stageOf = createMap<string, number>()
  for (const task of tasks) {
    const named = stages.findIndex((targets) => targets.includes(task.target))
    stageOf.set(task.id, named === -1 ? max(stages.length - 1, 0) : named)
  }
  // why: a prerequisite moved to an earlier stage takes what it needs along, so the pass repeats until nothing moves
  for (let moved = true; moved; ) {
    moved = false
    for (const task of tasks) {
      const own = stageOf.get(task.id) as number
      for (const need of task.needs) {
        // why: a need outside the tasks given is not staged here, and compares as already early enough
        if ((stageOf.get(need) ?? own) <= own) continue
        stageOf.set(need, own)
        moved = true
      }
    }
  }
  return stageOf
}

/**
 * Runs the stages in order, each to its end, and stops after the first that did not succeed whole.
 * A stage no task belongs to is passed over.
 *
 * @param options - The tasks, the stage of each and how one stage runs
 * @returns The stage that ended the run, if one did, and the tasks that never started
 *
 * @example A failed first stage keeps the second from starting
 * ```typescript
 * import { runStages } from '@hyperfrontend/workspace/progress'
 *
 * const tasks = [{ id: 'lib-core:lint' }, { id: 'lib-core:test' }]
 * const stageOf = new Map([
 *   ['lib-core:lint', 0],
 *   ['lib-core:test', 1],
 * ])
 * await runStages({ tasks, stageOf, runStage: async (stage) => stage.every((task) => task.id !== 'lib-core:lint') })
 * // => { stopped: 0, notRun: ['lib-core:test'] }
 * ```
 */
export async function runStages<Task extends Identified>(options: StagedOptions<Task>): Promise<StagedRun> {
  const { tasks, stageOf } = options
  for (const stage of [...createSet(tasks.map((task) => stageOf.get(task.id) as number))].sort((left, right) => left - right)) {
    const succeeded = await options.runStage(
      tasks.filter((task) => stageOf.get(task.id) === stage),
      stage
    )
    if (succeeded) continue
    return { stopped: stage, notRun: tasks.filter((task) => (stageOf.get(task.id) as number) > stage).map((task) => task.id) }
  }
  return { stopped: null, notRun: [] }
}
