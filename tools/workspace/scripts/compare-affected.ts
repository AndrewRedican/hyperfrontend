/**
 * Compares the owned affected analysis with Nx's selection and writes a Markdown report. Without a
 * range it reads the replay captures under `.hf/replay/`, checks each merge's head (and base) out
 * in a worktree, runs the owned analysis there and classifies every difference; with `--base` it
 * captures Nx's selection for the range in the working tree and compares that. With `--rebuild
 * <n>` it rebuilds up to `n` of the build tasks the owned analysis would have skipped at both
 * revisions and records whether their `dist` output is byte-identical. The report is advisory; the
 * exit code is zero unless `--strict` is given and a category (c) task is found. Usage, from the
 * workspace root: `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/scripts/compare-affected.ts`.
 *
 * @module scripts/compare-affected
 */

import type { NxExplanation, ReplayedMerge } from '../src/baseline/model'
import type { RangeComparison, RebuildCandidate, TargetComparison } from '../src/compare/classify'
import type { RebuildResult } from '../src/compare/report'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { parseArgs } from 'node:util'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { nxRunner } from '@hyperfrontend/integration-nx/adapters'
import { hashContent } from '../src/artifact-drift/pack'
import { captureBaseline, DEFAULT_TARGETS } from '../src/baseline/capture'
import { git, withWorktree } from '../src/baseline/replay'
import { compareTargets, sampleRebuilds, totalCounts } from '../src/compare/classify'
import { RebuildOutcome, renderReport } from '../src/compare/report'
import { selectAffected } from '../src/graph/affected/select'
import { buildGraph } from '../src/graph/build'
import { changeSet } from '../src/graph/changes'
import { targetExecutor } from '../src/graph/inputs'
import { compareText } from '../src/graph/order'
import { buildState } from '../src/graph/store/state'

/** A range to compare: where its Nx selection comes from and where the owned analysis runs. */
interface RangeSource {
  /** What the range is called in the report. */
  readonly label: string
  /** The base revision. */
  readonly base: string
  /** The head revision. */
  readonly head: string
  /** Whether the Nx capture ran against a `node_modules` installed from another lock file. */
  readonly lockfileSkew: boolean
  /** Nx's selection, captured already or captured now in the checkout. */
  readonly explain: (checkout: string) => NxExplanation
  /** Whether the head is the working tree, whose persisted graph state is reused. */
  readonly inWorkingTree: boolean
}

/** What one analysed range leaves behind for the rebuild pass. */
interface Analysed {
  /** The comparison. */
  readonly range: RangeComparison
  /** The root of each project whose build runs the package build executor, by task id. */
  readonly rebuildable: ReadonlyMap<string, string>
}

/** The executor whose builds are rebuilt for the drift check; the frozen demos and the site run another. */
const PACKAGE_BUILD = '@hyperfrontend/package:build'

/** The memory the lefthook build hook grants a build. */
const BUILD_NODE_OPTIONS = '--expose-gc --max-old-space-size=4096'

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string', default: 'HEAD' },
    label: { type: 'string', default: 'range' },
    replay: { type: 'string', default: '.hf/replay' },
    count: { type: 'string' },
    targets: { type: 'string', default: DEFAULT_TARGETS.join(',') },
    out: { type: 'string', default: '.hf/replay/report.md' },
    rebuild: { type: 'string', default: '0' },
    'skip-previous': { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    summary: { type: 'boolean', default: false },
  },
})

const root = git(process.cwd(), ['rev-parse', '--show-toplevel'])
const targets = values.targets.split(',')

/**
 * Writes a line to standard output.
 *
 * @param line - The text, without its newline
 */
function say(line: string): void {
  process.stdout.write(`${line}\n`)
}

/**
 * The replay captures, newest first.
 *
 * @param directory - The replay directory, workspace-relative
 * @param count - How many to read, or null for all
 * @returns One range per capture, its explanation read from the file
 */
function replayedRanges(directory: string, count: number | null): RangeSource[] {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) throw createError(`no replay captures under ${directory}; run replay-affected first`)
  const records = readdirSync(absolute)
    .filter((name) => /^[0-9a-f]{40}\.json$/.test(name))
    .map((name) => parse(readFileSync(join(absolute, name), 'utf8')) as ReplayedMerge)
    .sort((left, right) => compareText(right.committedAt, left.committedAt) || compareText(left.sha, right.sha))
  return records.slice(0, count ?? records.length).map((record) => ({
    label: `${record.kind} ${record.sha.slice(0, 12)}`,
    base: record.base,
    head: record.head,
    lockfileSkew: record.lockfileSkew,
    explain: () => record.selection.explanation,
    inWorkingTree: false,
  }))
}

/**
 * The range given on the command line, whose Nx selection is captured now.
 *
 * @param base - The base revision
 * @param head - The head revision
 * @returns The range, resolved to the merge base and the head commit
 */
function liveRange(base: string, head: string): RangeSource {
  return {
    label: values.label,
    base: git(root, ['merge-base', base, head]),
    head: git(root, ['rev-parse', head]),
    lockfileSkew: false,
    explain: (checkout) => captureBaseline({ base, head, targets, run: nxRunner(checkout) }).explanation,
    inWorkingTree: true,
  }
}

/**
 * Runs work with the base revision checked out beside, unless the previous graph is skipped.
 *
 * @param base - The base revision
 * @param work - The work, given the base checkout or null
 * @returns What the work returned
 */
function withPrevious<Result>(base: string, work: (checkout: string | null) => Result): Result {
  return values['skip-previous'] ? work(null) : withWorktree(root, base, work)
}

/**
 * Runs the owned analysis in a checkout of the head and compares it with Nx's selection.
 *
 * @param source - The range
 * @param checkout - The head checkout
 * @returns The comparison and what the rebuild pass needs
 */
function analyseIn(source: RangeSource, checkout: string): Analysed {
  const explanation = source.explain(checkout)
  return withPrevious(source.base, (previousCheckout) => {
    const graph = source.inWorkingTree ? buildState(root).graph : buildGraph(checkout)
    const previous = previousCheckout === null ? undefined : buildGraph(previousCheckout)
    const changes = changeSet(checkout, source.base, source.inWorkingTree ? null : source.head)
    const sets = selectAffected({ graph, changes, targets, previous })
    const compared = compareTargets(explanation, sets, targets)
    const rebuildable = createMap<string, string>()
    for (const project of graph.projects.values()) {
      if (targetExecutor(graph.root, project, 'build')?.value === PACKAGE_BUILD) rebuildable.set(`${project.name}:build`, project.root)
    }
    return {
      range: {
        label: source.label,
        base: source.base,
        head: source.head,
        lockfileSkew: source.lockfileSkew,
        changedFiles: changes.changes.length,
        targets: compared,
      },
      rebuildable,
    }
  })
}

/**
 * Analyses one range, in the working tree or in a worktree of its head.
 *
 * @param source - The range
 * @returns The comparison and what the rebuild pass needs
 */
function analyse(source: RangeSource): Analysed {
  return source.inWorkingTree ? analyseIn(source, root) : withWorktree(root, source.head, (checkout) => analyseIn(source, checkout))
}

/**
 * One line summarising a target's comparison.
 *
 * @param target - The comparison
 * @returns The target with its counts
 */
function describeTarget(target: TargetComparison): string {
  const { counts } = target
  return `${target.target} nx ${target.nxSelected} owned ${target.ownedSelected} (a) ${counts['narrower-explained']} (b) ${counts.wider} (c) ${counts['narrower-unexplained']} nx-only ${counts['nx-only']}`
}

/**
 * The content hash of every file under a directory, by POSIX path relative to it.
 *
 * @param directory - The directory, absolute
 * @returns The hashes, or an empty map when the directory does not exist
 */
function hashTree(directory: string): Map<string, string> {
  const hashes = createMap<string, string>()
  if (!existsSync(directory)) return hashes
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
      const path = relative === '' ? entry.name : posix.join(relative, entry.name)
      if (entry.isDirectory()) walk(path)
      else hashes.set(path, hashContent(readFileSync(join(directory, path))))
    }
  }
  walk('')
  return hashes
}

/**
 * Builds a task in a checkout, bypassing the Nx cache.
 *
 * @param checkout - The checkout the build runs in
 * @param task - The task id
 * @returns Null when the build succeeded, else the first line of what failed
 */
function buildIn(checkout: string, task: string): string | null {
  try {
    nxRunner(checkout, { env: { NODE_OPTIONS: BUILD_NODE_OPTIONS, CI: '1' } })(['run', task, '--skip-nx-cache'])
    return null
  } catch (error) {
    return (error as Error).message.split(/\r?\n/)[0] ?? 'build failed'
  }
}

/**
 * Rebuilds the sampled tasks at both revisions of their range and compares the output trees.
 *
 * @param candidates - The tasks sampled
 * @param roots - The project root of each rebuildable task, by range label
 * @returns One result per candidate, in the order given
 */
function rebuildAll(candidates: readonly RebuildCandidate[], roots: ReadonlyMap<string, ReadonlyMap<string, string>>): RebuildResult[] {
  const results = createMap<RebuildCandidate, RebuildResult>()
  const byRange = createMap<string, RebuildCandidate[]>()
  for (const candidate of candidates) byRange.set(candidate.label, [...(byRange.get(candidate.label) ?? []), candidate])
  for (const own of byRange.values()) {
    const { base, head } = own[0] as RebuildCandidate
    withWorktree(root, head, (headCheckout) =>
      withWorktree(root, base, (baseCheckout) => {
        for (const candidate of own) {
          const projectRoot = roots.get(candidate.label)?.get(candidate.task) as string
          say(`rebuilding ${candidate.task} at ${base.slice(0, 12)} and ${head.slice(0, 12)}`)
          if (!existsSync(join(baseCheckout, projectRoot, 'project.json'))) {
            results.set(candidate, { candidate, outcome: RebuildOutcome.Skipped, detail: 'the project does not exist at the base' })
            continue
          }
          const failed = buildIn(baseCheckout, candidate.task) ?? buildIn(headCheckout, candidate.task)
          if (failed !== null) {
            results.set(candidate, { candidate, outcome: RebuildOutcome.Skipped, detail: failed })
            continue
          }
          const before = hashTree(join(baseCheckout, 'dist', projectRoot))
          const after = hashTree(join(headCheckout, 'dist', projectRoot))
          const files = [...createSet([...before.keys(), ...after.keys()])]
            .filter((file) => before.get(file) !== after.get(file))
            .sort(compareText)
          results.set(candidate, {
            candidate,
            outcome: files.length === 0 ? RebuildOutcome.Identical : RebuildOutcome.Different,
            detail: files.length === 0 ? `${after.size} files` : files.join(', '),
          })
        }
      })
    )
  }
  return candidates.map((candidate) => results.get(candidate) as RebuildResult)
}

const sources =
  values.base === undefined
    ? replayedRanges(values.replay, values.count === undefined ? null : Number(values.count))
    : [liveRange(values.base, values.head)]
const analysed: Analysed[] = []
for (const source of sources) {
  const started = performance.now()
  const result = analyse(source)
  analysed.push(result)
  say(`${source.label}: ${result.range.changedFiles} files, ${round(performance.now() - started)} ms`)
  for (const target of result.range.targets) say(`  ${describeTarget(target)}`)
}
const ranges = analysed.map((item) => item.range)
const roots = createMap(analysed.map((item) => [item.range.label, item.rebuildable] as const))
const candidates = sampleRebuilds(ranges, Number(values.rebuild), (task) => [...roots.values()].some((own) => own.has(task)))
const rebuilds = candidates.length === 0 ? [] : rebuildAll(candidates, roots)
const notes = [
  'A target decided by the owned analysis is compared task by task; a task Nx selected that the owned graph has no task for is counted under "Nx only". The `lint` tasks of every project but the workspace are inferred by the lint plugin and not read by the owned graph yet.',
  'A wider selection is documented when it rests on `dependent-task`, `global-config` and `tool-changed` alone: a task selected because a task it runs after is selected, which Nx does not do; because `nx.json`, the root `package.json`, the lock file or `tsconfig.base.json` changed, which the owned analysis treats as invalidating every task while Nx weighs what changed in them; or because the source of the executor the task runs changed, which Nx does not read.',
  `Rebuilds cover build tasks running ${PACKAGE_BUILD}, each built at the base and the head of its range with the Nx cache bypassed, and compare every file under the project's dist directory. The two revisions are built in two worktrees, so a file that embeds its own absolute build path differs between them whatever the source did; the single-executable binary of the builder embeds the path of its main script.`,
]
const report = renderReport({ generatedAt: createDate().toISOString(), targets, ranges, rebuilds, notes })
const out = join(root, values.out)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, report)
if (values.summary && process.env['GITHUB_STEP_SUMMARY'] !== undefined) appendFileSync(process.env['GITHUB_STEP_SUMMARY'], report)
const totals = totalCounts(ranges)
say(
  `${ranges.length} range${ranges.length === 1 ? '' : 's'}: agree ${totals.agree}, (a) ${totals['narrower-explained']}, (b) ${totals.wider}, (c) ${totals['narrower-unexplained']}, nx-only ${totals['nx-only']}; report at ${values.out}`
)
if (values.strict && totals['narrower-unexplained'] > 0) process.exitCode = 1
