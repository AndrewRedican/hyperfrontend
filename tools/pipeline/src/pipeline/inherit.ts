/**
 * Outcome inheritance: a task of a plan keeps the success an earlier run recorded for it when the
 * selection, asked what changed since the tree that run stood on, leaves the task out. Nothing is
 * stored or restored and no file's content is judged; the plan stays the whole plan and an
 * inherited task is a mark on it, which a reader may decline.
 *
 * @module pipeline/inherit
 */

import type { Environment, Origin, Plan, PlanTask, RunResults } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isFinite, isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from '@hyperfrontend/workspace/graph'
import { HF_ENTRY, PROBE_SCRIPT } from './commands'
import { Outcome } from './model'

/** How long a recorded success stays a proof, counted from when the task really ended: seven days. */
export const PROOF_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The directory of the code that plans, defines each task's command and records outcomes. */
const PIPELINE_SOURCES = 'tools/pipeline/src/pipeline/'

/** The directory under it that only the specs read. */
const PIPELINE_TEST_UTILITIES = `${PIPELINE_SOURCES}__test-utils__/`

/** The files a task is started through: the command line that plans, runs and records, the workspace's own command line every project task starts, and the floor probe. */
const TASK_ENTRIES: readonly string[] = ['tools/pipeline/bin/pipeline.ts', HF_ENTRY, PROBE_SCRIPT]

/** The directories of the code right behind those entries, each ending in a slash; their specs are left out. */
const TASK_SOURCES: readonly string[] = [PIPELINE_SOURCES, 'libs/workspace/src/bin/']

/** The files that decide how an environment is checked out, installed and started on a pull request; one ending in a slash is a directory. */
const ENVIRONMENT_FILES: readonly string[] = ['.github/workflows/ci-pr.yml', '.github/actions/', '.npmrc', '.nvmrc', '.gitattributes']

/** What an object id looks like; nothing else read from a results file is handed to git or printed as one. */
const OBJECT_ID = /^[0-9a-f]{40,64}$/

/** What a Node.js release looks like, as `process.version` names it. */
const NODE_RELEASE = /^v\d+\.\d+\.\d+[\w.+-]*$/

/** Text that holds no space, line break or control character, which is all a run's page address may be. */
const PLAIN_TEXT = /^[\x21-\x7e]*$/

/** One environment's part of an inheritance. */
export interface InheritSource {
  /** The environment the proofs were recorded on. */
  readonly environment: Environment
  /** The plan of the change from the tree the proofs stand on to the tree the full plan is made on. */
  readonly since: Plan
  /** The successes recorded on the environment, by task id, each with where it really ran. */
  readonly proofs: ReadonlyMap<string, Origin>
}

/** What an inheritance needs. */
export interface InheritOptions {
  /** The plan of the whole change. */
  readonly full: Plan
  /** The sources, at most one per environment; an environment without one inherits nothing. */
  readonly sources: readonly InheritSource[]
}

/**
 * Whether nothing is inherited across a change to a file: one that decides what a task id runs
 * or what a recorded success means (the pipeline's own code, the command line every task is
 * started through, the floor probe), or how an environment is checked out, installed and started
 * (the pull request workflow, its actions, the npm, Node.js and git attribute files). No task
 * reads these as an input, so the selection cannot say what a change to one reaches.
 *
 * @param path - The workspace-relative path, as git writes it
 * @returns True for such a file; specs and the pipeline's test utilities are left out
 */
export function blocksInheritance(path: string): boolean {
  if (TASK_ENTRIES.includes(path)) return true
  if (ENVIRONMENT_FILES.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry))) return true
  return (
    TASK_SOURCES.some((directory) => path.startsWith(directory)) && !path.endsWith('.spec.ts') && !path.startsWith(PIPELINE_TEST_UTILITIES)
  )
}

/**
 * Whether a value read from a results file is an object id.
 *
 * @param value - What the file holds
 * @returns True for 40 to 64 lowercase hexadecimal characters
 */
export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID.test(value)
}

/**
 * Whether a value read from a results file is a run id or an attempt.
 *
 * @param value - What the file holds
 * @returns True for a whole number
 */
export function isRunNumber(value: unknown): value is number {
  return typeof value === 'number' && isSafeInteger(value)
}

/**
 * Whether an origin read from a results file has the shape of one. The file is another run's, so
 * each field is checked before it marks a task, reaches git or is printed: a run and an attempt
 * that are both numbers or both null, a head commit that is an object id or null, a page address
 * that is plain text or null, a tree that is an object id, a Node.js release and a time.
 *
 * @param origin - The origin as the file holds it, whatever its fields really are
 * @returns True when every field is what an origin holds
 */
function isOrigin(origin: Readonly<Record<keyof Origin, unknown>>): boolean {
  const { run, attempt, sha, url, tree, node, endedAt } = origin
  const numbered = run === null ? attempt === null : isRunNumber(run) && isRunNumber(attempt)
  const addressed = url === null || (typeof url === 'string' && PLAIN_TEXT.test(url))
  const released = typeof node === 'string' && NODE_RELEASE.test(node)
  return (
    numbered &&
    (sha === null || isObjectId(sha)) &&
    addressed &&
    isObjectId(tree) &&
    released &&
    typeof endedAt === 'number' &&
    isFinite(endedAt)
  )
}

/**
 * The proofs a results file offers: its successes by task id, each with its origin. A success
 * that was itself inherited keeps the origin it came with, so the age counts from the run the
 * task really ran in however many runs passed it along.
 *
 * @param results - The results of one environment's earlier run
 * @param now - The time the age is counted to, epoch milliseconds
 * @returns The origins by task id; none from a file that names no tested tree or no Node.js release, and none whose origin is not shaped like one
 */
export function proofsOf(results: RunResults, now: number): Map<string, Origin> {
  const proofs = createMap<string, Origin>()
  const { tested, node } = results
  if (tested === undefined || node === undefined) return proofs
  const run = results.run ?? null
  const identity =
    run === null ? { run: null, attempt: null, sha: null, url: null } : { run: run.id, attempt: run.attempt, sha: run.sha, url: run.url }
  for (const task of results.tasks) {
    if (task.outcome !== Outcome.Success) continue
    // why: a success that names neither an origin nor an end did not run where anything can vouch for it
    const origin = task.inherited ?? (task.endedAt === null ? null : { ...identity, tree: tested.tree, node, endedAt: task.endedAt })
    if (origin !== null && isOrigin(origin) && now - origin.endedAt < PROOF_AGE_MS) proofs.set(task.id, origin)
  }
  return proofs
}

/**
 * The tasks a plan holds for one environment.
 *
 * @param plan - The plan read
 * @param environment - Linux, Windows or macOS
 * @returns The tasks, in chain order
 */
function tasksOf(plan: Plan, environment: Environment): PlanTask[] {
  return plan.chains.filter((chain) => chain.environment === environment).flatMap((chain) => chain.tasks)
}

/**
 * A plan with the tasks of some chains rewritten.
 *
 * @param plan - The plan rewritten
 * @param rewrite - Answers the task that takes a task's place
 * @returns The plan, every task passed through the rewrite
 */
function mapTasks(plan: Plan, rewrite: (task: PlanTask) => PlanTask): Plan {
  return { ...plan, chains: plan.chains.map((chain) => ({ ...chain, tasks: chain.tasks.map(rewrite) })) }
}

/**
 * Marks the tasks of a plan that keep an earlier outcome. Per environment: every task the change
 * since the proofs' tree selects runs; every task without a proof runs, and so does every task
 * it needs, transitively; every other task is inherited from its proof. A task the change since
 * selects and the full plan does not hold is ignored, since the whole change does not reach it.
 *
 * @param options - The full plan and each environment's source
 * @returns The full plan, the inherited tasks marked with their origin and their needs left in place
 */
export function inheritPlan(options: InheritOptions): Plan {
  const origins = createMap<string, Origin>()
  for (const source of options.sources) {
    const tasks = tasksOf(options.full, source.environment)
    const byId = createMap(tasks.map((task) => [task.id, task] as const))
    const changed = createSet(tasksOf(source.since, source.environment).map((task) => task.id))
    const required = createSet<string>()
    // why: a need does not say whether it is about order or about files on disk, so a task that runs for want of a proof takes every task it needs with it
    const require = (id: string): void => {
      if (required.has(id)) return
      required.add(id)
      for (const need of (byId.get(id) as PlanTask).needs) require(need)
    }
    for (const task of tasks) if (!source.proofs.has(task.id)) require(task.id)
    for (const task of tasks) {
      if (!changed.has(task.id) && !required.has(task.id))
        origins.set(`${source.environment} ${task.id}`, source.proofs.get(task.id) as Origin)
    }
  }
  return mapTasks(options.full, (task) => {
    const origin = origins.get(`${task.environment} ${task.id}`)
    return origin === undefined ? task : { ...task, inherited: origin }
  })
}

/**
 * A plan with every mark of one environment cleared, which is how an environment declines its
 * inheritance: what is left is the plan as it would have been made without any.
 *
 * @param plan - The plan, marked or not
 * @param environment - The environment that runs all of its tasks
 * @returns The plan with no inherited task on that environment
 */
export function declineInheritance(plan: Plan, environment: Environment): Plan {
  return mapTasks(plan, (task) => {
    const { inherited, ...unmarked } = task
    return inherited === undefined || task.environment !== environment ? task : unmarked
  })
}

/**
 * The tasks of an environment that run, as the scheduler takes them: an inherited task is left
 * out, and so is every need on one, since the scheduler refuses a need it does not hold.
 *
 * @param tasks - The tasks of one environment, marked or not
 * @returns The tasks without a mark, each without its needs on inherited tasks
 */
export function scheduledNeeds<Task extends PlanTask>(tasks: readonly Task[]): Task[] {
  const inherited = createSet(tasks.filter((task) => task.inherited !== undefined).map((task) => task.id))
  return tasks
    .filter((task) => task.inherited === undefined)
    .map((task) => ({ ...task, needs: task.needs.filter((need) => !inherited.has(need)) }))
}

/** What an environment's run says of itself before it accepts the marks of its plan. */
export interface AcceptOptions {
  /** The Node.js release of the process that runs the tasks, as `process.version` names it. */
  readonly node: string
  /** Whether the command line or the environment asked for every task to run. */
  readonly off: boolean
}

/**
 * The plan an environment runs: the plan as given, or with the environment's marks cleared when
 * every task was asked to run, or when its inherited tasks ran on another Node.js release, since
 * a task proven on one release is not proven on another.
 *
 * @param plan - The plan, marked or not
 * @param environment - The environment about to run
 * @param options - The release of the process that runs it, and whether every task was asked to run
 * @param report - Receives one line when the environment declines its inheritance
 * @returns The plan to run
 */
export function acceptInheritance(plan: Plan, environment: Environment, options: AcceptOptions, report: (line: string) => void): Plan {
  const origins = tasksOf(plan, environment).flatMap((task) => (task.inherited === undefined ? [] : [task.inherited]))
  const others = [...createSet(origins.map((origin) => origin.node).filter((node) => node !== options.node))].sort(compareText)
  if (origins.length === 0 || (!options.off && others.length === 0)) return plan
  report(
    options.off
      ? `nothing is inherited on ${environment}: every task was asked to run`
      : `nothing is inherited on ${environment}: its proofs are from Node.js ${others.join(', ')} and this run is on ${options.node}`
  )
  return declineInheritance(plan, environment)
}

/**
 * An origin as a reader names it.
 *
 * @param origin - Where a task really ran
 * @returns `run <id>` for a workflow run, else the tree a run on this machine stood on
 */
export function originName(origin: Origin): string {
  return origin.run === null ? `a local run on tree ${origin.tree.slice(0, 7)}` : `run ${origin.run}`
}

/**
 * Where a group of inherited tasks comes from, in a few words.
 *
 * @param origins - The origins of the tasks, one each
 * @returns The one run they share, or how many runs they come from
 */
export function inheritedFrom(origins: readonly Origin[]): string {
  const names = [...createSet(origins.map(originName))]
  return names.length === 1 ? (names[0] as string) : `${names.length} runs`
}

/**
 * How much of a plan runs and how much inherits, in one line.
 *
 * @param plan - The plan, marked or not
 * @returns Such as `44 tasks run, 320 inherited from run 45062206244`, or null when no task inherits
 */
export function inheritanceLine(plan: Plan): string | null {
  const tasks = plan.chains.flatMap((chain) => chain.tasks)
  const origins = tasks.flatMap((task) => (task.inherited === undefined ? [] : [task.inherited]))
  if (origins.length === 0) return null
  const running = tasks.length - origins.length
  return `${running} ${running === 1 ? 'task runs' : 'tasks run'}, ${origins.length} inherited from ${inheritedFrom(origins)}`
}
