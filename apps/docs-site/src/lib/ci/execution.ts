import type {
  ChainState,
  CompactPlan,
  Environment,
  GitHubCheckRun,
  GitHubRun,
  Outcome,
  PlanReason,
  RunOutcome,
  RunRecord,
  Weight,
} from './model'
import { dateParse } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isNaN } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** The environments, in the order the page lists them. */
export const ENVIRONMENTS: readonly Environment[] = ['linux', 'windows', 'macos']

/**
 * Where a task stands: one of the four outcomes once it ended, `queued` before its chain started,
 * `blocked` while a prerequisite has not succeeded, `ready` while it runs or waits for a slot, and
 * `unknown` when the record holds no result for it.
 */
export type TaskState = Outcome | 'queued' | 'blocked' | 'ready' | 'unknown'

/** One task of an execution. */
export interface ExecutionTask {
  /** `<project>:<target>` */
  id: string
  /** The chain's project */
  project: string
  /** The target */
  target: string
  /** Where the task runs */
  environment: Environment
  /** The slot it occupies */
  weight: Weight
  /** The tasks of the same environment that must succeed first; empty when a live plan was truncated */
  needs: readonly string[]
  /** Where the task stands */
  state: TaskState
  /** The exit code, or null */
  exitCode: number | null
  /** Why it was skipped or cancelled, or null */
  detail: string | null
  /** When it started, epoch milliseconds, or null */
  startedAt: number | null
  /** When it ended, epoch milliseconds, or null */
  endedAt: number | null
  /** How long it ran, or null when it has not both started and ended */
  durationMs: number | null
  /** Why the task is in the plan; a record keeps the first few, a live run none */
  reasons: readonly PlanReason[]
  /** How many more reasons the plan gave than the record keeps */
  reasonsOmitted: number
}

/** Where a chain stands: `queued` before its first task starts, `running` until every task ended, then its conclusion; `incomplete` when a record lacks results for some of its tasks. */
export type ChainStatus = 'queued' | 'running' | 'success' | 'failure' | 'cancelled' | 'incomplete'

/** One project on one environment. */
export interface ExecutionChain {
  /** The project */
  project: string
  /** Where the chain runs */
  environment: Environment
  /** The rank the scheduler serves it in */
  order: number
  /** Its tasks, prerequisites first */
  tasks: readonly ExecutionTask[]
  /** Where the chain stands */
  status: ChainStatus
  /** When its first task started, or null */
  startedAt: number | null
  /** When its last task ended, or null */
  endedAt: number | null
  /** The chain's check run on GitHub, or null */
  url: string | null
}

/** Where a job of the run stands. */
export type JobStatus = 'queued' | 'running' | 'completed'

/** One environment's job. */
export interface ExecutionLane {
  /** The environment */
  environment: Environment
  /** Where the job stands */
  status: JobStatus
  /** Its conclusion once completed, as GitHub words it, or null */
  conclusion: string | null
  /** When it started, or null */
  startedAt: number | null
  /** When it ended, or null */
  endedAt: number | null
  /** The job's page, or null */
  url: string | null
  /** Whether its results reached the end; false for a record whose results stop short */
  complete: boolean
}

/** A job of the run other than the environments: the plan, the records, the status and the release jobs. */
export interface ExecutionStage {
  /** The job's name */
  name: string
  /** Where it stands */
  status: JobStatus
  /** Its conclusion once completed, or null */
  conclusion: string | null
  /** When it started, or null */
  startedAt: number | null
  /** When it ended, or null */
  endedAt: number | null
  /** Its page, or null */
  url: string | null
}

/** Where the run stands as GitHub words it. */
export type ExecutionStatus = 'queued' | 'in_progress' | 'completed'

/** Which workflow a run is of. */
export type Workflow = 'ci' | 'pr' | 'other'

/** The plan without its tasks. */
export interface ExecutionPlan {
  /** Whether the plan was selected or runs everything */
  mode: 'affected' | 'all'
  /** Whether the plan publishes */
  main: boolean
  /** The base revision, or `all` */
  base: string
  /** The head revision, or null */
  head: string | null
  /** The environments with chains */
  environments: readonly Environment[]
  /** How many tasks the selection skipped with a reason */
  skipped: number
  /** Whether a live plan dropped its needs to fit */
  truncated: boolean
}

/** Which run an execution is of. */
export interface ExecutionRun {
  /** The run id */
  id: number
  /** The run number */
  number: number
  /** The attempt */
  attempt: number
  /** The commit */
  sha: string
  /** The branch, or null for a detached commit */
  branch: string | null
  /** The event that started it */
  event: string
  /** The run's page */
  url: string
  /** Which workflow */
  workflow: Workflow
}

/** The run's clock: when its first job started and when its last one ended, or now while it runs. */
export interface ExecutionClock {
  /** Epoch milliseconds, or null when nothing has started */
  start: number | null
  /** Epoch milliseconds, or null when nothing has started */
  end: number | null
}

/** One execution of the pipeline: a run recorded on the records branch or one read from GitHub, in one shape. */
export interface Execution {
  /** Where the execution was read from */
  source: 'record' | 'live'
  /** Which run */
  run: ExecutionRun
  /** Where the run stands */
  status: ExecutionStatus
  /** What the run ended as, or null while it runs or when GitHub's conclusion maps to nothing */
  outcome: RunOutcome | null
  /** The conclusion as GitHub words it, or null */
  conclusion: string | null
  /** The plan, or null before a live run publishes it */
  plan: ExecutionPlan | null
  /** The chains, in scheduling order */
  chains: readonly ExecutionChain[]
  /** The environments' jobs, in the order the page lists them */
  lanes: readonly ExecutionLane[]
  /** The other jobs, in start order; empty for a record, which keeps none */
  stages: readonly ExecutionStage[]
  /** The run's clock */
  clock: ExecutionClock
  /** When the execution was read or recorded */
  readAt: number
}

/** The name of the check run carrying the plan. */
export const PLAN_CHECK_NAME = 'pipeline plan'

/** The conclusions GitHub gives a job or run that did not succeed, cancel or get skipped. */
const FAILURE_CONCLUSIONS: readonly string[] = ['failure', 'timed_out', 'startup_failure', 'action_required', 'stale']

/**
 * The branch of a ref.
 *
 * @param ref - `refs/heads/<branch>` or anything else
 * @returns The branch, or null
 */
export function branchOf(ref: string): string | null {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : null
}

/**
 * Which workflow a run's file is.
 *
 * @param path - The workflow file, such as `.github/workflows/ci-main.yml`
 * @returns `ci`, `pr` or `other`
 */
export function workflowOf(path: string): Workflow {
  if (path.endsWith('/ci-main.yml')) return 'ci'
  if (path.endsWith('/ci-pr.yml')) return 'pr'
  return 'other'
}

/**
 * An ISO time as epoch milliseconds.
 *
 * @param iso - The time, or null
 * @returns Epoch milliseconds, or null
 */
export function epochOf(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null
  const parsed = dateParse(iso)
  return isNaN(parsed) ? null : parsed
}

/**
 * The outcome a conclusion maps to.
 *
 * @param conclusion - A conclusion as GitHub words it, or null
 * @returns The outcome, or null for none yet or one that maps to nothing
 */
export function outcomeOfConclusion(conclusion: string | null): RunOutcome | null {
  if (conclusion === 'success') return 'success'
  if (conclusion === 'cancelled') return 'cancelled'
  if (conclusion !== null && FAILURE_CONCLUSIONS.includes(conclusion)) return 'failure'
  return null
}

/**
 * The conclusion of a set of ended tasks: failure when any failed or was skipped behind a failure,
 * cancelled when any was cancelled, else success.
 *
 * @param states - The states of the tasks
 * @returns The conclusion the tasks add up to
 */
export function conclusionOf(states: readonly TaskState[]): 'success' | 'failure' | 'cancelled' {
  if (states.some((state) => state === 'failure' || state === 'skipped')) return 'failure'
  if (states.some((state) => state === 'cancelled')) return 'cancelled'
  return 'success'
}

/**
 * The earliest and latest of some times.
 *
 * @param starts - Start times, null ones ignored
 * @param ends - End times, null ones ignored
 * @returns The earliest start and the latest end, each null when none is known
 */
export function spanOf(starts: readonly (number | null)[], ends: readonly (number | null)[]): ExecutionClock {
  const known = (times: readonly (number | null)[]): number[] => times.filter((time): time is number => time !== null)
  const startTimes = known(starts)
  const endTimes = known(ends)
  return {
    start: startTimes.length === 0 ? null : min(...startTimes),
    end: endTimes.length === 0 ? null : max(...endTimes),
  }
}

/**
 * A chain's status from its tasks.
 *
 * @param tasks - The tasks of the chain, with their recorded states
 * @returns Incomplete when a task has no result, else the conclusion of the ended tasks
 */
function recordedChainStatus(tasks: readonly ExecutionTask[]): ChainStatus {
  if (tasks.some((task) => task.state === 'unknown')) return 'incomplete'
  return conclusionOf(tasks.map((task) => task.state))
}

/**
 * The execution a record describes: every lane completed, the tasks with their recorded results.
 *
 * @param record - The run's record
 * @returns The execution
 */
export function fromRecord(record: RunRecord): Execution {
  const chains: ExecutionChain[] = [...record.plan.chains]
    .sort((left, right) => left.order - right.order)
    .map((chain) => {
      const results = createMap((record.results[chain.environment]?.tasks ?? []).map((result) => [result.id, result] as const))
      const tasks: ExecutionTask[] = chain.tasks.map((task) => {
        const result = results.get(task.id) ?? null
        return {
          id: task.id,
          project: task.project,
          target: task.target,
          environment: task.environment,
          weight: task.weight,
          needs: task.needs,
          state: result?.outcome ?? 'unknown',
          exitCode: result?.exitCode ?? null,
          detail: result?.detail ?? null,
          startedAt: result?.startedAt ?? null,
          endedAt: result?.endedAt ?? null,
          durationMs: result === null || result.startedAt === null ? null : result.durationMs,
          reasons: task.reasons,
          reasonsOmitted: task.reasonsOmitted,
        }
      })
      const span = spanOf(
        tasks.map((task) => task.startedAt),
        tasks.map((task) => task.endedAt)
      )
      return {
        project: chain.project,
        environment: chain.environment,
        order: chain.order,
        tasks,
        status: recordedChainStatus(tasks),
        startedAt: span.start,
        endedAt: span.end,
        url: null,
      }
    })
  const lanes: ExecutionLane[] = ENVIRONMENTS.filter((environment) => record.plan.environments.includes(environment)).map((environment) => {
    const results = record.results[environment]
    const states = chains.filter((chain) => chain.environment === environment).flatMap((chain) => chain.tasks.map((task) => task.state))
    return {
      environment,
      status: 'completed',
      conclusion: results === undefined || !results.complete ? null : conclusionOf(states),
      startedAt: results?.startedAt ?? null,
      endedAt: results?.endedAt ?? null,
      url: null,
      complete: results?.complete ?? false,
    }
  })
  const states = chains.flatMap((chain) => chain.tasks.map((task) => task.state))
  const outcome: RunOutcome = lanes.some((lane) => !lane.complete) ? 'incomplete' : conclusionOf(states)
  return {
    source: 'record',
    run: {
      id: record.run.id,
      number: record.run.number,
      attempt: record.run.attempt,
      sha: record.run.sha,
      branch: branchOf(record.run.ref),
      event: record.run.event,
      url: record.run.url,
      workflow: 'ci',
    },
    status: 'completed',
    outcome,
    conclusion: outcome,
    plan: {
      mode: record.plan.mode,
      main: record.plan.main,
      base: record.plan.base,
      head: record.plan.head,
      environments: record.plan.environments,
      skipped: record.plan.skipped.length,
      truncated: false,
    },
    chains,
    lanes,
    stages: [],
    clock: spanOf(
      lanes.map((lane) => lane.startedAt),
      lanes.map((lane) => lane.endedAt)
    ),
    readAt: record.recordedAt,
  }
}

/** A document stamped with the schema the page reads. */
interface Versioned {
  /** The schema */
  schema: 1
}

/**
 * The JSON a check run's text carries, when it carries the expected schema.
 *
 * @param text - The text, or null
 * @returns The parsed value, or null
 */
function carried<Value extends Versioned>(text: string | null): Value | null {
  if (text === null) return null
  try {
    const value = parse(text) as Value
    return value.schema === 1 ? value : null
  } catch {
    return null
  }
}

/**
 * Where a check run stands.
 *
 * @param run - The check run
 * @returns Queued, running or completed
 */
function jobStatusOf(run: GitHubCheckRun): JobStatus {
  return run.status === 'completed' ? 'completed' : run.status === 'queued' ? 'queued' : 'running'
}

/**
 * The state of a task its chain's check run has not listed as ended.
 *
 * @param chainStatus - Where the chain stands
 * @param needs - The task's needs
 * @param ended - The ended tasks of the chain, by id
 * @param laneDone - Whether the environment's job has completed
 * @returns Unknown when the job is over, queued before the chain started, blocked behind a need, else ready
 */
function pendingState(
  chainStatus: JobStatus,
  needs: readonly string[],
  ended: ReadonlyMap<string, ChainState['tasks'][number]>,
  laneDone: boolean
): TaskState {
  if (laneDone) return 'unknown'
  if (chainStatus === 'queued') return 'queued'
  return needs.every((need) => ended.get(need)?.outcome === 'success') ? 'ready' : 'blocked'
}

/**
 * The execution the check runs of a run's suite describe: the plan from the `pipeline plan` check
 * run, each chain from its own check run, the environments and the other jobs from theirs.
 *
 * @param run - The run as GitHub lists it
 * @param checkRuns - Every check run of its suite
 * @param readAt - When they were read, epoch milliseconds
 * @returns The execution
 */
export function fromLive(run: GitHubRun, checkRuns: readonly GitHubCheckRun[], readAt: number): Execution {
  const planRun = checkRuns.find((check) => check.name === PLAN_CHECK_NAME) ?? null
  const compact = planRun === null ? null : carried<CompactPlan>(planRun.output.text)
  const chainRuns = createMap<string, GitHubCheckRun>()
  const laneRuns = createMap<Environment, GitHubCheckRun>()
  const stages: ExecutionStage[] = []
  for (const check of checkRuns) {
    if (check === planRun) continue
    if ((ENVIRONMENTS as readonly string[]).includes(check.name)) {
      laneRuns.set(check.name as Environment, check)
      continue
    }
    if (/ \((linux|windows|macos)\)$/.test(check.name)) {
      chainRuns.set(check.name, check)
      continue
    }
    stages.push({
      name: check.name,
      status: jobStatusOf(check),
      conclusion: check.conclusion,
      startedAt: epochOf(check.started_at),
      endedAt: epochOf(check.completed_at),
      url: check.html_url,
    })
  }
  const environments = compact?.environments ?? ENVIRONMENTS.filter((environment) => laneRuns.has(environment))
  const lanes: ExecutionLane[] = ENVIRONMENTS.filter((environment) => environments.includes(environment)).map((environment) => {
    const found = laneRuns.get(environment) ?? null
    const status = found === null ? 'queued' : jobStatusOf(found)
    return {
      environment,
      status,
      conclusion: found?.conclusion ?? null,
      startedAt: epochOf(found?.started_at),
      endedAt: epochOf(found?.completed_at),
      url: found?.html_url ?? null,
      complete: status === 'completed',
    }
  })
  const laneDone = (environment: Environment): boolean => lanes.find((lane) => lane.environment === environment)?.status === 'completed'
  const chains: ExecutionChain[] = [...(compact?.chains ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((chain) => {
      const found = chainRuns.get(`${chain.project} (${chain.environment})`) ?? null
      const state = found === null ? null : carried<ChainState>(found.output.text)
      const ended = createMap((state?.tasks ?? []).map((task) => [task.id, task] as const))
      const chainStatus: JobStatus = found === null ? 'queued' : jobStatusOf(found)
      const tasks: ExecutionTask[] = chain.tasks.map((task) => {
        const result = ended.get(task.id) ?? null
        const startedAt = result?.startedAt ?? null
        const endedAt = result?.endedAt ?? null
        return {
          id: task.id,
          project: chain.project,
          target: task.target,
          environment: chain.environment,
          weight: task.weight,
          needs: task.needs,
          state: result?.outcome ?? pendingState(chainStatus, task.needs, ended, laneDone(chain.environment)),
          exitCode: result?.exitCode ?? null,
          detail: result?.detail ?? null,
          startedAt,
          endedAt,
          durationMs: startedAt === null || endedAt === null ? null : endedAt - startedAt,
          reasons: [],
          reasonsOmitted: 0,
        }
      })
      const status: ChainStatus =
        chainStatus === 'completed'
          ? tasks.some((task) => task.state === 'unknown')
            ? 'incomplete'
            : (outcomeOfConclusion(found?.conclusion ?? null) ?? conclusionOf(tasks.map((task) => task.state)))
          : chainStatus === 'running'
            ? 'running'
            : laneDone(chain.environment)
              ? 'incomplete'
              : 'queued'
      return {
        project: chain.project,
        environment: chain.environment,
        order: chain.order,
        tasks,
        status,
        startedAt: epochOf(found?.started_at),
        endedAt: epochOf(found?.completed_at),
        url: found?.html_url ?? null,
      }
    })
  const status: ExecutionStatus = run.status === 'completed' ? 'completed' : run.status === 'queued' ? 'queued' : 'in_progress'
  const started = epochOf(run.run_started_at) ?? epochOf(run.created_at)
  const ends = [...lanes.map((lane) => lane.endedAt), ...stages.map((stage) => stage.endedAt), epochOf(run.updated_at)]
  return {
    source: 'live',
    run: {
      id: run.id,
      number: run.run_number,
      attempt: run.run_attempt,
      sha: run.head_sha,
      branch: run.head_branch,
      event: run.event,
      url: run.html_url,
      workflow: workflowOf(run.path),
    },
    status,
    outcome: outcomeOfConclusion(run.conclusion),
    conclusion: run.conclusion,
    plan:
      compact === null
        ? null
        : {
            mode: compact.mode,
            main: compact.main,
            base: compact.base,
            head: compact.head,
            environments: compact.environments,
            skipped: compact.skipped,
            truncated: compact.truncated,
          },
    chains,
    lanes,
    stages: stages.sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0)),
    clock: { start: started, end: status === 'completed' ? spanOf([], ends).end : readAt },
    readAt,
  }
}

/**
 * The plan check run of a run among those of its commit: a pull request's plan and chains land in
 * a suite of their own, so the one that started first after the run did is the run's.
 *
 * @param candidates - The commit's check runs named for the plan
 * @param startedAt - When the run started, or null
 * @returns The run's plan check run, or null when the commit has none
 */
export function planCheckFor(candidates: readonly GitHubCheckRun[], startedAt: number | null): GitHubCheckRun | null {
  const timed = candidates.map((check) => ({ check, at: epochOf(check.started_at) ?? 0 })).sort((left, right) => left.at - right.at)
  const after = startedAt === null ? null : timed.find((entry) => entry.at >= startedAt)
  return after?.check ?? timed[timed.length - 1]?.check ?? null
}

/** How many tasks stand each way. */
export type StateCounts = Record<TaskState, number>

/**
 * How many tasks stand each way.
 *
 * @param tasks - Any tasks
 * @returns A count per state, zero for the states none is in
 */
export function countStates(tasks: readonly ExecutionTask[]): StateCounts {
  const counts: StateCounts = { success: 0, failure: 0, skipped: 0, cancelled: 0, queued: 0, blocked: 0, ready: 0, unknown: 0 }
  for (const task of tasks) counts[task.state] += 1
  return counts
}

/**
 * Every task of an execution, in chain order.
 *
 * @param execution - The execution whose tasks are listed
 * @returns The tasks of every chain, flattened
 */
export function allTasks(execution: Execution): ExecutionTask[] {
  return execution.chains.flatMap((chain) => [...chain.tasks])
}
