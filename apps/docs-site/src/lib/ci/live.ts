import type { ChainState, CompactPlan, Environment, GitHubCheckRun, GitHubJob, Outcome, Weight } from './model'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** Where a task of a running pipeline stands. */
export type LiveTaskState = 'queued' | 'pending' | 'ended'

/** One task of a running chain. */
export interface LiveTask {
  /** The task id */
  id: string
  /** The target */
  target: string
  /** The slot it occupies */
  weight: Weight
  /** What must succeed first */
  needs: string[]
  /** Queued before the chain started, pending while it runs, ended once the check run lists it */
  state: LiveTaskState
  /** What it ended as, when it did */
  outcome: Outcome | null
  /** Why it was skipped or cancelled, or null */
  detail: string | null
  /** When it started, or null */
  startedAt: number | null
  /** When it ended, or null */
  endedAt: number | null
}

/** One chain of a running pipeline. */
export interface LiveChain {
  /** The project */
  project: string
  /** The environment */
  environment: Environment
  /** The scheduling rank */
  order: number
  /** `queued` before its check run exists, `in_progress` or `completed` as the check run says */
  status: 'queued' | 'in_progress' | 'completed'
  /** The check run's conclusion once completed */
  conclusion: string | null
  /** The check run's page, or null */
  url: string | null
  /** The tasks */
  tasks: LiveTask[]
}

/** A running pipeline as the check runs of its commit describe it. */
export interface LiveRun {
  /** The plan the `pipeline plan` check run carries, or null before it is published */
  plan: CompactPlan | null
  /** The chains, in scheduling order */
  chains: LiveChain[]
  /** The check runs that carry none of this, by name */
  others: GitHubCheckRun[]
}

/** The name of the check run carrying the plan. */
const PLAN_CHECK_NAME = 'pipeline plan'

/** A document stamped with the schema this page reads. */
interface Versioned {
  /** The schema */
  schema: 1
}

/** A chain's check run with the state it carries. */
interface ChainCheck {
  /** The check run */
  run: GitHubCheckRun
  /** The state its text carries, or null */
  state: ChainState | null
}

/** How far a running pipeline has come. */
export interface LiveProgress {
  /** The tasks that ended */
  ended: number
  /** The tasks planned */
  total: number
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
 * The running pipeline the check runs of a commit describe.
 *
 * @param checkRuns - The commit's check runs
 * @returns The plan, the chains with each task's state, and the check runs that are something else
 */
export function liveRun(checkRuns: readonly GitHubCheckRun[]): LiveRun {
  const planRun = checkRuns.find((run) => run.name === PLAN_CHECK_NAME)
  const plan = planRun === undefined ? null : carried<CompactPlan>(planRun.output.text)
  const states = createMap<string, ChainCheck>()
  const others: GitHubCheckRun[] = []
  for (const run of checkRuns) {
    if (run === planRun) continue
    const match = /^(.+) \((linux|windows|macos)\)$/.exec(run.name)
    if (match === null) {
      others.push(run)
      continue
    }
    states.set(run.name, { run, state: carried<ChainState>(run.output.text) })
  }
  const chains: LiveChain[] = (plan?.chains ?? []).map((chain) => {
    const found = states.get(`${chain.project} (${chain.environment})`)
    const ended = createMap((found?.state?.tasks ?? []).map((task) => [task.id, task] as const))
    const status = found === undefined ? 'queued' : found.run.status === 'completed' ? 'completed' : 'in_progress'
    return {
      project: chain.project,
      environment: chain.environment,
      order: chain.order,
      status,
      conclusion: found?.run.conclusion ?? null,
      url: found?.run.html_url ?? null,
      tasks: chain.tasks.map((task) => {
        const result = ended.get(task.id)
        return {
          id: task.id,
          target: task.target,
          weight: task.weight,
          needs: task.needs,
          state: result !== undefined ? 'ended' : status === 'queued' ? 'queued' : 'pending',
          outcome: result?.outcome ?? null,
          detail: result?.detail ?? null,
          startedAt: result?.startedAt ?? null,
          endedAt: result?.endedAt ?? null,
        }
      }),
    }
  })
  for (const [name, { run }] of states) {
    if (!chains.some((chain) => `${chain.project} (${chain.environment})` === name)) others.push(run)
  }
  return { plan, chains: chains.sort((left, right) => left.order - right.order), others }
}

/**
 * The job of an environment among a run's jobs.
 *
 * @param jobs - The run's jobs
 * @param environment - Linux, Windows or macOS
 * @returns The job, or null
 */
export function environmentJob(jobs: readonly GitHubJob[], environment: Environment): GitHubJob | null {
  return jobs.find((job) => job.name === environment) ?? null
}

/**
 * How far a running pipeline has come.
 *
 * @param run - The pipeline as its check runs describe it
 * @returns The tasks ended and the tasks planned
 */
export function liveProgress(run: LiveRun): LiveProgress {
  let ended = 0
  let total = 0
  for (const chain of run.chains) {
    for (const task of chain.tasks) {
      total += 1
      if (task.state === 'ended') ended += 1
    }
  }
  return { ended, total }
}
