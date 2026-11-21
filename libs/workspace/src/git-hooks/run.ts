/**
 * Runs the steps of a hook in order. Each step has the terminal to itself while it runs; the
 * first that fails ends the hook, and the hook ends on one line per step saying how it ended,
 * how long it took, or what skipped it.
 *
 * @module git-hooks/run
 */

import type { Terminal } from '../progress/terminal'
import type { HookName, HookStep } from './config'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { formatDuration } from '../progress/log'
import { Ending, markOf } from '../progress/matrix'
import { Style } from '../progress/terminal'

/** A hook to run. */
export interface HookRun {
  /** The hook, as the step list is headed. */
  readonly hook: HookName
  /** Its steps, in order. */
  readonly steps: readonly HookStep[]
  /** The arguments Git gave the hook. */
  readonly args: readonly string[]
  /** Why a step is skipped, or null when it runs. */
  readonly skipOf: (step: string) => string | null
}

/** What the runner is given to run steps and say how they ended. */
export interface HookHost {
  /** Starts a step with its arguments and settles on its exit code. */
  readonly start: (step: HookStep, args: readonly string[]) => Promise<number>
  /** The time, in milliseconds. */
  readonly now: () => number
  /** Where the lines are written. */
  readonly terminal: Terminal
  /** The files that are fully staged. */
  readonly fullyStaged: () => string[]
  /** Stages again the files a step changed, among those given. */
  readonly restage: (before: readonly string[]) => unknown
}

/** How one step ended. */
interface StepEnd {
  /** The step's name. */
  readonly name: string
  /** How it ended. */
  readonly ending: Ending
  /** What follows the name: the duration, or why the step did not run. */
  readonly detail: string
}

/**
 * Runs one step, staging again what it fixed when it asks for that and succeeds.
 *
 * @param step - What runs, and whether it fixes files
 * @param args - The arguments Git gave the hook
 * @param host - How steps run
 * @returns The exit code
 */
async function runStep(step: HookStep, args: readonly string[], host: HookHost): Promise<number> {
  const before = step.stageFixed === true ? host.fullyStaged() : []
  const code = await host.start(step, step.passArgs === true ? args : [])
  if (code === 0 && step.stageFixed === true) host.restage(before)
  return code
}

/**
 * Runs the steps of a hook in order and reports them.
 *
 * @param run - The hook, its steps, Git's arguments and which steps are skipped
 * @param host - How steps run and where the report is written
 * @returns The exit code: 0 when every step that ran succeeded, 1 otherwise
 *
 * @example A push whose audit fails before the long step starts
 * ```typescript
 * import { createTerminal } from '@hyperfrontend/workspace/progress'
 * import { runHook } from '@hyperfrontend/workspace/git-hooks'
 *
 * const code = await runHook(
 *   {
 *     hook: 'pre-push',
 *     steps: [
 *       { name: 'audit', run: ['hf', 'run-many', '-t', 'audit', '--all'], failText: 'The audit failed.' },
 *       { name: 'pipeline', run: ['hf', 'affected', '-t', 'test'] },
 *     ],
 *     args: ['origin', 'git@example.com:acme/repo.git'],
 *     skipOf: () => null,
 *   },
 *   {
 *     start: async (step) => (step.name === 'audit' ? 1 : 0),
 *     now: () => performance.now(),
 *     terminal: createTerminal(process.stderr, process.env),
 *     fullyStaged: () => [],
 *     restage: () => [],
 *   }
 * )
 * // => 1, after the lines:
 * //   pre-push
 * //     ✗ audit     0s
 * //     · pipeline  not run
 * //   The audit failed.
 * ```
 */
export async function runHook(run: HookRun, host: HookHost): Promise<number> {
  const { terminal } = host
  const ends: StepEnd[] = []
  let failed: HookStep | null = null
  for (const step of run.steps) {
    const skippedBy = run.skipOf(step.name)
    if (failed !== null) {
      ends.push({ name: step.name, ending: Ending.NotRun, detail: 'not run' })
    } else if (skippedBy !== null) {
      ends.push({ name: step.name, ending: Ending.Skipped, detail: `skipped by ${skippedBy}` })
    } else {
      terminal.line(terminal.paint(`▸ ${step.name}`, Style.Bold))
      const startedAt = host.now()
      const succeeded = (await runStep(step, run.args, host)) === 0
      ends.push({ name: step.name, ending: succeeded ? Ending.Passed : Ending.Failed, detail: formatDuration(host.now() - startedAt) })
      if (!succeeded) failed = step
    }
  }
  const width = max(...ends.map((end) => end.name.length))
  terminal.line(terminal.paint(run.hook, Style.Bold))
  for (const end of ends) terminal.line(`  ${markOf(end.ending, terminal.paint)} ${end.name.padEnd(width)}  ${end.detail}`)
  if (failed?.failText !== undefined) terminal.line(failed.failText)
  return failed === null ? 0 : 1
}
