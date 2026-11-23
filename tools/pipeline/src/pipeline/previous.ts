/**
 * The earlier runs a plan inherits from: each environment's results file read as a source of
 * proofs, the tree those proofs stand on found again in the clone, and the plan marked with what
 * the change since that tree leaves proven.
 *
 * @module pipeline/previous
 */

import type { WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import type { InheritSource } from './inherit'
import type { Environment, Origin, Plan, RunResults, Tested } from './model'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { baseRecords } from '@hyperfrontend/workspace/graph'
import { blocksInheritance, inheritanceLine, inheritPlan, isObjectId, isRunNumber, proofsOf } from './inherit'
import { Environment as Environments } from './model'
import { createPlan } from './plan'
import { changesBetween, reasonOf, treeCommit } from './tested'

/** The earlier results of one environment, as a plan may inherit from them. */
export interface PreviousSource {
  /** The environment the results are of. */
  readonly environment: Environment
  /** What the run stood on. */
  readonly tested: Tested
  /** Its successes still young enough to count, by task id. */
  readonly proofs: ReadonlyMap<string, Origin>
  /** The run as a reader names it. */
  readonly name: string
  /** Whether the hook's own kind of run wrote the file: one that planned the working tree and ran it at once. */
  readonly local: boolean
}

/** A plan that names the tree it was made on. */
export interface TestedPlan extends Plan {
  /** What the plan was made on. */
  readonly tested: Tested
}

/** What marking a plan from earlier runs needs. */
export interface InheritFromOptions {
  /** The workspace root, absolute. */
  readonly root: string
  /** The graph of the working tree. */
  readonly graph: WorkspaceGraph
  /** The plan of the whole change, with the tree it was made on. */
  readonly plan: TestedPlan
  /** The earlier results, at most one source per environment. */
  readonly previous: readonly PreviousSource[]
  /** The environments that may inherit; every environment of the plan by default. */
  readonly environments?: readonly Environment[]
  /** Receives one line per case in which nothing is inherited. */
  readonly report: (line: string) => void
}

/** How long one git command of the search for an earlier tree may take, a fetch included, before it counts as failed. */
const GIT_TIMEOUT_MS = 120 * 1000

/**
 * Whether git answers a command without failing, in time and without asking anyone anything.
 *
 * @param root - The repository root, absolute
 * @param args - The arguments after `git`
 * @returns True when the command exits with zero; false when it fails, runs out of time or would have prompted for credentials
 */
function succeeds(root: string, args: readonly string[]): boolean {
  try {
    execFileSync('git', [...args], {
      cwd: root,
      stdio: 'ignore',
      timeout: GIT_TIMEOUT_MS,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return true
  } catch {
    return false
  }
}

/**
 * A commit id as a results file names it, when it is one.
 *
 * @param id - What the file holds
 * @returns The id, or null for anything that is not an object id
 */
function commitOf(id: unknown): string | null {
  return isObjectId(id) ? id : null
}

/**
 * An earlier results file as a source of proofs.
 *
 * @param results - The results of one environment's earlier run
 * @param now - The time the proofs' age is counted to, epoch milliseconds
 * @returns The source, or null when the file names no tested tree, as one written before runs recorded it
 */
export function sourceOf(results: RunResults, now: number): PreviousSource | null {
  const tree = commitOf(results.tested?.tree)
  if (results.tested === undefined || tree === null) return null
  const { head, base, merge } = results.tested
  return {
    environment: results.environment,
    tested: { tree, head: commitOf(head), base: commitOf(base), merge: commitOf(merge) },
    proofs: proofsOf(results, now),
    name: isRunNumber(results.run?.id) ? `run ${results.run.id}` : 'the last run on this machine',
    local: results.local === true,
  }
}

/**
 * The source a results file on disk is, for the environment its place names.
 *
 * @param file - The results file, absolute
 * @param environment - The environment the file is of
 * @param now - The time the proofs' age is counted to, epoch milliseconds
 * @returns The source, or null when the file is absent, does not parse or names no tested tree
 */
export function sourceAt(file: string, environment: Environment, now: number): PreviousSource | null {
  if (!existsSync(file)) return null
  try {
    return sourceOf({ ...(parse(readFileSync(file, 'utf8')) as RunResults), environment }, now)
  } catch {
    // why: a run killed while it rewrote the file leaves half of one, which proves nothing
    return null
  }
}

/**
 * The sources a directory of downloaded results holds: `<environment>/results-<environment>.json`
 * for each environment that has one.
 *
 * @param directory - The directory, absolute
 * @param now - The time the proofs' age is counted to, epoch milliseconds
 * @returns One source per environment whose file is there, parses and names a tested tree
 */
export function previousSources(directory: string, now: number): PreviousSource[] {
  return values(Environments).flatMap((environment) => {
    const source = sourceAt(join(directory, environment, `results-${environment}.json`), environment, now)
    return source === null ? [] : [source]
  })
}

/**
 * Brings a commit into the clone when it is not there, from the remote the clone came from.
 *
 * @param root - The repository root, absolute
 * @param sha - The id of the commit wanted
 */
function fetchCommit(root: string, sha: string): void {
  if (!succeeds(root, ['cat-file', '-e', `${sha}^{commit}`])) succeeds(root, ['fetch', '--quiet', '--no-tags', 'origin', sha])
}

/**
 * The tree an earlier run stood on, once it is in the clone: as it is, else rebuilt by merging the
 * recorded head into the recorded base, else read off the recorded merge commit, each fetched
 * when missing. A tree's id is its content, so the tree is accepted only under the recorded id.
 *
 * @param root - The repository root, absolute
 * @param tested - What the earlier run stood on
 * @returns The tree id, or null when the clone cannot be made to hold it
 */
export function previousTree(root: string, tested: Tested): string | null {
  const present = (): boolean => succeeds(root, ['cat-file', '-e', `${tested.tree}^{tree}`])
  if (present()) return tested.tree
  if (tested.head !== null && tested.base !== null) {
    fetchCommit(root, tested.head)
    fetchCommit(root, tested.base)
    // why: the merge is written into the object store whatever it comes out as; only the recorded id is then looked for
    succeeds(root, ['merge-tree', '--write-tree', tested.base, tested.head])
    if (present()) return tested.tree
  }
  if (tested.merge !== null) {
    fetchCommit(root, tested.merge)
    if (present()) return tested.tree
  }
  return null
}

/**
 * The plan of the change from an earlier run's tree to the tree a plan is made on.
 *
 * @param options - The repository, the graph and the plan of the whole change
 * @param tested - What the earlier run stood on
 * @returns The plan of the change since, or why nothing can be inherited across it
 */
function planSince(options: InheritFromOptions, tested: Tested): Plan | string {
  const { root, graph, plan } = options
  const tree = previousTree(root, tested)
  if (tree === null) return `its tree ${tested.tree.slice(0, 7)} is not in the clone and could not be fetched or rebuilt`
  try {
    const changes = changesBetween(root, treeCommit(root, tree), plan.tested.tree)
    const blocking = changes.changes.flatMap((change) => [change.path, change.previousPath ?? change.path]).find(blocksInheritance)
    if (blocking !== undefined)
      return `${blocking} changed since, and no task reads it as an input: it decides what a task runs or how its environment is set up`
    return createPlan({ graph, changes, main: false, targets: plan.targets, ...baseRecords(root, changes) })
  } catch (error) {
    // why: the plan of the whole change stands without this one, so a failure here costs the inheritance and never the plan
    return `the change since its tree could not be planned (${reasonOf(error)})`
  }
}

/**
 * Marks the tasks of a plan that keep the outcome of an earlier run. Each environment inherits
 * from its own source; environments whose sources stand on the same tree share one plan of the
 * change since. Nothing is inherited by a plan that runs everything or publishes, on an environment
 * without a source, from a tree the clone cannot hold, or across a change to a file that decides
 * what a task runs or how its environment is set up.
 *
 * @param options - The repository, the graph, the plan, the sources and where the lines go
 * @returns The plan, marked where a task inherits; the plan itself where none can
 */
export function inheritFrom(options: InheritFromOptions): Plan {
  const { plan, report } = options
  if (plan.mode === 'all' || plan.main) {
    report(`nothing is inherited: the plan ${plan.main ? 'publishes, and proves everything it ships itself' : 'runs everything'}`)
    return plan
  }
  const since = createMap<string, Plan | string>()
  const sources: InheritSource[] = []
  for (const environment of options.environments ?? plan.environments) {
    const previous = options.previous.find((source) => source.environment === environment)
    if (previous === undefined) {
      report(`nothing is inherited on ${environment}: no earlier run left results that name the tree they stand on`)
      continue
    }
    const { tree } = previous.tested
    if (!since.has(tree)) since.set(tree, planSince(options, previous.tested))
    const planned = since.get(tree) as Plan | string
    if (typeof planned === 'string') report(`nothing is inherited on ${environment} from ${previous.name}: ${planned}`)
    else sources.push({ environment, since: planned, proofs: previous.proofs })
  }
  if (sources.length === 0) return plan
  const marked = inheritPlan({ full: plan, sources })
  // why: how much inherits is said by the summary of the plan; only the case where nothing does needs a line of its own
  if (inheritanceLine(marked) === null)
    report('no task is inherited: every task of the plan is reached by the change since, or has no proof')
  return marked
}
