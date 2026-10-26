/**
 * Plans and runs the pipeline. Usage, from the workspace root:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/pipeline.ts <command>`, or
 * `npx nx run tool-workspace:pipeline -- <command>`, where the command is
 * `plan [--base <ref>] [--head <ref>] [--all] [--fallback-all] [--main] [--catch-up] [--nx-targets <list>] [--out <file>] [--summary] [--github-output] [--force]`,
 * `run [--plan <file>] [--environment linux|windows] [--parallel <n>] [--heavy <n>] [--local] [--results <file>] [--summary] [--checks] [--wait-for <job>] [--head-sha <sha>]`,
 * `affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain|--projects]` or
 * `summary --results <file> [--plan <file>] [--summary]`.
 *
 * @module bin/pipeline
 */

import type { WorkspaceGraph } from '../src/graph/build'
import type { ChangeSet } from '../src/graph/selection'
import type { ChainChecks } from '../src/pipeline/checks'
import type { RunOutcome } from '../src/pipeline/execute'
import type { Chain, Environment, Plan, PlanTask, RunResults, TaskResult } from '../src/pipeline/model'
import type { ScheduleResult } from '../src/pipeline/schedule'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism, totalmem } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { parseArgs } from 'node:util'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { nxRunner } from '@hyperfrontend/integration-nx/adapters'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { parseAffectedProjects } from '../src/baseline/capture'
import { formatAffected } from '../src/graph/affected/explain'
import { selectAffected } from '../src/graph/affected/select'
import { changeSet } from '../src/graph/changes'
import { buildState } from '../src/graph/store/state'
import { chainChecks, githubChecks } from '../src/pipeline/checks'
import { executeTask, replayLines, runCommand } from '../src/pipeline/execute'
import { Environment as Environments, Outcome, PipelineRule } from '../src/pipeline/model'
import { createPlan } from '../src/pipeline/plan'
import { npmProbe, registryDrift } from '../src/pipeline/registry'
import { planSummary, runSummary } from '../src/pipeline/report'
import { runSchedule } from '../src/pipeline/schedule'
import { githubJobs, waitForJob } from '../src/pipeline/siblings'

/** A task as the scheduler sees it: with its chain's rank. */
interface RankedTask extends PlanTask {
  /** The chain's rank. */
  readonly order: number
}

/** The usage line. */
const USAGE =
  'expected plan [--base <ref>] [--head <ref>] [--all] [--fallback-all] [--main] [--catch-up] [--nx-targets <list>] [--out <file>] [--summary] [--github-output] [--force], run [--plan <file>] [--environment <env>] [--parallel <n>] [--heavy <n>] [--local] [--results <file>] [--summary] [--checks] [--wait-for <job>] [--head-sha <sha>], affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain|--projects] or summary --results <file> [--plan <file>] [--summary]'

/** Where the pipeline keeps its files, workspace-relative. */
const PIPELINE_DIRECTORY = '.hf/pipeline'

/** The runner image of each environment. */
const RUNNERS: Readonly<Record<Environment, string>> = { linux: 'ubuntu-latest', windows: 'windows-latest' }

/** How long the Linux environment waits for the Windows one before publishing. */
const SIBLING_TIMEOUT_MS = 20 * 60 * 1000

/** How long between two polls of the sibling job. */
const SIBLING_INTERVAL_MS = 30 * 1000

/** Below this much memory only one heavy task runs at a time. */
const HEAVY_MEMORY_BYTES = 12 * 1024 * 1024 * 1024

const { values, positionals } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string' },
    all: { type: 'boolean', default: false },
    'fallback-all': { type: 'boolean', default: false },
    main: { type: 'boolean', default: false },
    'catch-up': { type: 'boolean', default: false },
    'nx-targets': { type: 'string', default: '' },
    out: { type: 'string' },
    summary: { type: 'boolean', default: false },
    'github-output': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    plan: { type: 'string' },
    environment: { type: 'string' },
    parallel: { type: 'string' },
    heavy: { type: 'string' },
    local: { type: 'boolean', default: false },
    results: { type: 'string' },
    checks: { type: 'boolean', default: false },
    'wait-for': { type: 'string' },
    'head-sha': { type: 'string' },
    target: { type: 'string' },
    json: { type: 'boolean', default: false },
    explain: { type: 'boolean', default: false },
    projects: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})
const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'nx.json')))
if (root === null) throw createError('run from inside the workspace: no nx.json above the working directory')
const [command] = positionals
const grouped = process.env['GITHUB_ACTIONS'] === 'true'

/**
 * Writes a line to standard output.
 *
 * @param line - The text, without its newline
 */
function say(line: string): void {
  process.stdout.write(`${line}\n`)
}

/**
 * Appends lines to the job summary when one is open.
 *
 * @param lines - The Markdown lines
 */
function summarise(lines: readonly string[]): void {
  const file = process.env['GITHUB_STEP_SUMMARY']
  if (values.summary && file !== undefined) appendFileSync(file, `${lines.join('\n')}\n\n`)
}

/**
 * Writes a JSON file, creating its directory.
 *
 * @param path - The path, workspace-relative
 * @param value - What to write
 */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolvePath(path)), { recursive: true })
  writeFileSync(resolvePath(path), `${stringify(value, null, 2)}\n`)
}

/**
 * A path of the command line: absolute as given, else under the workspace root.
 *
 * @param path - The path as the command line names it
 * @returns The absolute path
 */
function resolvePath(path: string): string {
  return isAbsolute(path) ? path : join(root as string, path)
}

/**
 * The environment the process runs on.
 *
 * @returns Windows on win32, Linux otherwise
 */
function ownEnvironment(): Environment {
  return process.platform === 'win32' ? Environments.Windows : Environments.Linux
}

/**
 * Whether a revision exists and is an ancestor of the head.
 *
 * @param revision - A commit, branch or tag name
 * @returns True when `git merge-base --is-ancestor` agrees
 */
function isAncestor(revision: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', revision, 'HEAD'], { cwd: root as string, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * The change set of the command line, or null for a full plan.
 *
 * @param local - Whether the base defaults to `origin/main` and the head to the working tree
 * @returns The change set, or null
 */
function changesOf(local: boolean): ChangeSet | null {
  if (values.all) return null
  const base = values.base ?? (local ? 'origin/main' : 'main')
  if (values['fallback-all'] && !isAncestor(base)) {
    say(`${base} is not an ancestor of HEAD: planning everything`)
    return null
  }
  return changeSet(root as string, base, values.head ?? null)
}

/**
 * The graph of the working tree, from the persisted state.
 *
 * @returns The graph of the working tree
 */
function graphOf(): WorkspaceGraph {
  const { graph, outcome } = buildState(root as string, { force: values.force })
  say(`graph state ${outcome.plan.mode}: ${outcome.plan.reparse.length} files parsed`)
  return graph
}

/**
 * Nx's project-level selection of a target, for the override.
 *
 * @param changes - The change set
 * @returns The projects Nx selects for a target
 */
function nxSelection(changes: ChangeSet): (target: string) => string[] {
  const run = nxRunner(root as string)
  return (target) =>
    parseAffectedProjects(
      run([
        'show',
        'projects',
        '--affected',
        '--json',
        `--base=${changes.base}`,
        `--head=${changes.head ?? 'HEAD'}`,
        `--with-target=${target}`,
      ])
    )
}

/**
 * Plans the change of the command line.
 *
 * @param local - Whether the plan is the hook's
 * @returns The chains and skips of the change
 */
async function plan(local: boolean): Promise<Plan> {
  const graph = graphOf()
  const changes = changesOf(local)
  const override = values['nx-targets'].split(',').filter((target) => target !== '')
  const drift =
    values.main && values['catch-up']
      ? await registryDrift(graph.projects.values(), npmProbe({ cwd: root as string, run: runCommand }))
      : []
  return createPlan({
    graph,
    changes,
    main: values.main,
    override,
    nxAffected: changes === null ? undefined : nxSelection(changes),
    drift,
  })
}

/**
 * Writes the plan, its summary and the workflow outputs.
 *
 * @param planned - What the change selected
 * @param out - Where the plan goes, workspace-relative
 */
function emitPlan(planned: Plan, out: string): void {
  writeJson(out, planned)
  const lines = planSummary(planned)
  for (const line of lines) say(line)
  summarise(lines)
  const output = process.env['GITHUB_OUTPUT']
  if (values['github-output'] && output !== undefined) {
    const include = planned.environments.map((environment) => ({ os: environment, runner: RUNNERS[environment] }))
    appendFileSync(output, `environments=${stringify({ include })}\nhas-work=${planned.chains.length > 0 ? 'true' : 'false'}\n`)
  }
}

/**
 * Reads a JSON file of the workspace.
 *
 * @param path - The path, workspace-relative
 * @returns The value
 */
function readJsonFile<Value>(path: string): Value {
  return parse(readFileSync(resolvePath(path), 'utf8')) as Value
}

/**
 * The gate the publishes wait at: the sibling job's conclusion, asked for once.
 *
 * @param planned - The plan, whose environments say whether a Windows job exists
 * @returns A function answering why the publishes must not run, or null when they may
 */
function siblingGate(planned: Plan): () => Promise<string | null> {
  // why: a plan without Windows chains has no Windows job to wait for, so the gate opens at once.
  const name = planned.environments.includes(Environments.Windows) ? values['wait-for'] : undefined
  const fetchJobs = name === undefined ? null : githubJobs(process.env, fetch)
  let pending: Promise<string | null> | null = null
  return () => {
    if (name === undefined) return createPromise((resolve) => resolve(null))
    if (fetchJobs === null)
      return createPromise((resolve) => resolve(`${PipelineRule.WindowsEnvironment}: no GitHub token to ask about ${name}`))
    pending ??= waitForJob({ fetchJobs, name, timeoutMs: SIBLING_TIMEOUT_MS, intervalMs: SIBLING_INTERVAL_MS }).then((conclusion) =>
      conclusion === 'success' ? null : `${PipelineRule.WindowsEnvironment}: ${name} concluded ${conclusion}`
    )
    return pending
  }
}

/**
 * The check-run hooks of the run, when asked for and possible.
 *
 * @returns The hooks, or null
 */
function checksOf(): ChainChecks | null {
  if (!values.checks) return null
  const api = githubChecks(process.env, fetch)
  const headSha = values['head-sha'] ?? process.env['GITHUB_SHA']
  if (api === null || headSha === undefined) {
    say('::notice::check runs are off: no GitHub token, repository or head sha')
    return null
  }
  return chainChecks(api, headSha, (message) => say(`::notice::${message}`))
}

/**
 * A task's result from the scheduler's.
 *
 * @param task - The planned task
 * @param result - What the scheduler recorded for it
 * @returns The result as the run file records it
 */
function toTaskResult(task: RankedTask, result: ScheduleResult): TaskResult {
  const { id, project, target, environment, reasons } = task
  const { outcome, exitCode, detail, startedAt, endedAt, durationMs, log } = result
  return { id, project, target, environment, reasons, outcome, exitCode, detail, startedAt, endedAt, durationMs, log }
}

/**
 * Runs the chains of one environment.
 *
 * @param planned - The plan
 * @param environment - Which environment's chains run
 * @param parallel - The light budget
 * @param heavy - The heavy budget
 * @returns The results
 */
async function runEnvironment(planned: Plan, environment: Environment, parallel: number, heavy: number): Promise<RunResults> {
  const chains = planned.chains.filter((chain) => chain.environment === environment)
  const tasks: RankedTask[] = chains.flatMap((chain) => chain.tasks.map((task) => ({ ...task, order: chain.order })))
  const chainOf = createMap<string, Chain>(tasks.map((task) => [task.id, chains.find((chain) => chain.project === task.project) as Chain]))
  const controller = new AbortController()
  const stop = (): void => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  const gate = siblingGate(planned)
  const checks = checksOf()
  const settled = createMap<string, TaskResult>()
  const startedChains = createSet<string>()
  const hooks: Promise<void>[] = []
  const started = dateNow()
  const run = async (task: RankedTask): Promise<RunOutcome> => {
    if (task.target === 'publish') {
      const closed = await gate()
      if (closed !== null) return { outcome: Outcome.Skipped, exitCode: null, log: null, detail: closed }
    }
    return executeTask(task, {
      root: root as string,
      logDirectory: `${PIPELINE_DIRECTORY}/logs`,
      env: { CI: '1' },
      signal: controller.signal,
    })
  }
  const results = await runSchedule({
    tasks,
    parallel,
    heavy,
    run,
    signal: controller.signal,
    onStart: (task) => {
      say(`▶ ${task.id}`)
      const chain = chainOf.get(task.id) as Chain
      if (checks !== null && !startedChains.has(chain.project)) {
        startedChains.add(chain.project)
        hooks.push(checks.onStart(chain))
      }
    },
    onEnd: (task, result) => {
      settled.set(task.id, toTaskResult(task, result))
      const text = result.log === null ? '' : readFileSync(join(root as string, result.log), 'utf8')
      const heading = `${task.id} (${result.outcome}${result.detail === null ? '' : `, ${result.detail}`}, ${round(result.durationMs / 1000)}s)`
      for (const line of replayLines(heading, text, grouped)) say(line)
      const chain = chainOf.get(task.id) as Chain
      if (checks !== null && chain.tasks.every((member) => settled.has(member.id)))
        hooks.push(
          checks.onEnd(
            chain,
            chain.tasks.map((member) => settled.get(member.id) as TaskResult)
          )
        )
    },
  })
  await promiseAll(hooks)
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
  const ended = dateNow()
  return {
    environment,
    base: planned.base,
    head: planned.head,
    mode: planned.mode,
    startedAt: started,
    endedAt: ended,
    durationMs: ended - started,
    tasks: tasks.map((task) => toTaskResult(task, results.get(task.id) as ScheduleResult)),
  }
}

/**
 * Runs the plan of the command line, or the hook's.
 */
async function run(): Promise<void> {
  const environment = (values.environment as Environment | undefined) ?? ownEnvironment()
  const planned = values.local ? await plan(true) : readJsonFile<Plan>(values.plan ?? `${PIPELINE_DIRECTORY}/plan.json`)
  if (values.local) for (const line of planSummary(planned)) say(line)
  const parallel = values.local ? 1 : Number(values.parallel ?? availableParallelism())
  const heavy = values.local || totalmem() < HEAVY_MEMORY_BYTES ? 1 : Number(values.heavy ?? 2)
  const results = await runEnvironment(planned, environment, parallel, heavy)
  writeJson(values.results ?? `${PIPELINE_DIRECTORY}/results-${environment}.json`, results)
  const lines = runSummary(results, planned)
  for (const line of lines) say(line)
  summarise(lines)
  process.exitCode = results.tasks.every((task) => task.outcome === Outcome.Success) ? 0 : 1
}

/**
 * Reports an error the command ended with and fails the process.
 *
 * @param error - What was thrown
 */
function fail(error: unknown): void {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exitCode = 1
}

if (command === 'plan') {
  plan(false)
    .then((planned) => emitPlan(planned, values.out ?? `${PIPELINE_DIRECTORY}/plan.json`))
    .catch(fail)
} else if (command === 'run') {
  run().catch(fail)
} else if (command === 'affected') {
  if (values.target === undefined) throw createError('affected needs --target <target>')
  const set = selectAffected({
    graph: graphOf(),
    changes: changeSet(root, values.base ?? 'main', values.head ?? null),
    targets: [values.target],
  }).get(values.target)
  if (set === undefined) throw createError(`no target ${values.target}`)
  if (values.json) say(stringify(set, null, 2))
  else if (values.projects) for (const decision of set.selected) say(decision.task.slice(0, decision.task.lastIndexOf(':')))
  else for (const line of formatAffected(set, values.explain ? 'explain' : 'tasks')) say(line)
} else if (command === 'summary') {
  if (values.results === undefined) throw createError('summary needs --results <file>')
  const lines = runSummary(readJsonFile<RunResults>(values.results), readJsonFile<Plan>(values.plan ?? `${PIPELINE_DIRECTORY}/plan.json`))
  for (const line of lines) say(line)
  summarise(lines)
} else {
  throw createError(`unknown command ${command ?? ''}: ${USAGE}`)
}
