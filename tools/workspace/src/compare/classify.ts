/**
 * Compares the owned affected analysis with the selection Nx captured for the same range, task by
 * task, and classifies every difference: narrower with a reason the owned analysis names for each
 * file Nx cites, wider, or narrower without such a reason. The last is the one that must never
 * happen before anything trusts the narrower sets.
 *
 * @module compare/classify
 */

import type { NxExplanation, NxReason } from '../baseline/model'
import type { AffectedSet, Reason, ReasonRule, TaskDecision } from '../graph/selection'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze, fromEntries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { affectedTasks } from '../baseline/capture'
import { compareText } from '../graph/order'
import { ReasonRule as Rules } from '../graph/selection'

/** How one task's owned decision compares with Nx's. */
export const Verdict = freeze({
  /** Both selected the task. */
  Agree: 'agree',
  /** Neither selected the task. */
  BothSkipped: 'both-skipped',
  /** Nx selected it; the owned analysis skipped it and names a rule for every file Nx cites: category (a). */
  NarrowerExplained: 'narrower-explained',
  /** The owned analysis selected it and Nx did not: category (b). */
  Wider: 'wider',
  /** Nx selected it; the owned analysis skipped it and has no answer for at least one of Nx's reasons: category (c). */
  NarrowerUnexplained: 'narrower-unexplained',
  /** Nx selected a task the owned graph does not have, such as one an Nx plugin infers. */
  NxOnly: 'nx-only',
} as const)

/** One of the verdicts. */
export type Verdict = (typeof Verdict)[keyof typeof Verdict]

/** The owned rules documented as selecting more than Nx does, so a wider task resting on them alone is expected: a task selected after a selected task; a change to a global configuration file, which Nx weighs by content and the owned analysis treats as invalidating every task; and a change to the source of the executor a task runs, which Nx does not read. */
export const DOCUMENTED_WIDER_RULES: readonly ReasonRule[] = freeze([Rules.DependentTask, Rules.GlobalConfig, Rules.ToolChanged])

/** One task compared. */
export interface TaskComparison {
  /** The task id, `<project>:<target>`. */
  readonly task: string
  /** How the two decisions compare. */
  readonly verdict: Verdict
  /** Nx's reasons for selecting the task; empty when it did not. */
  readonly nx: readonly NxReason[]
  /** The owned reasons: those selecting the task, or the skip reasons answering the files Nx cites. */
  readonly owned: readonly Reason[]
  /** The Nx reasons no owned skip reason answers; non-empty exactly for an unexplained narrowing. */
  readonly unanswered: readonly NxReason[]
  /** The distinct owned rules behind the decision, sorted. */
  readonly rules: readonly ReasonRule[]
  /** Whether a wider selection rests on documented rules alone. */
  readonly documented: boolean
}

/** How many tasks fell under each verdict. */
export type VerdictCounts = Readonly<Record<Verdict, number>>

/** One target compared over one range. */
export interface TargetComparison {
  /** The target. */
  readonly target: string
  /** How many tasks Nx selected. */
  readonly nxSelected: number
  /** How many tasks the owned analysis selected. */
  readonly ownedSelected: number
  /** Every task either side knows, sorted by id. */
  readonly tasks: readonly TaskComparison[]
  /** How many tasks fell under each verdict. */
  readonly counts: VerdictCounts
}

/** One range compared. */
export interface RangeComparison {
  /** What the range is called: a merge commit, or the pull request under comparison. */
  readonly label: string
  /** The base revision. */
  readonly base: string
  /** The head revision. */
  readonly head: string
  /** Whether the Nx capture ran against a `node_modules` installed from another lock file. */
  readonly lockfileSkew: boolean
  /** How many files changed. */
  readonly changedFiles: number
  /** The targets compared. */
  readonly targets: readonly TargetComparison[]
}

/** A build task the owned analysis would have skipped, to be rebuilt at both revisions. */
export interface RebuildCandidate {
  /** The range the task was skipped in. */
  readonly label: string
  /** The base revision. */
  readonly base: string
  /** The head revision. */
  readonly head: string
  /** The task id. */
  readonly task: string
}

/** The categories the plan names, by verdict. */
export const CATEGORIES: Readonly<Partial<Record<Verdict, string>>> = freeze({
  [Verdict.NarrowerExplained]: 'a',
  [Verdict.Wider]: 'b',
  [Verdict.NarrowerUnexplained]: 'c',
})

/**
 * The distinct rules of a list of reasons, sorted.
 *
 * @param reasons - The reasons whose rules are collected
 * @returns Each rule once, sorted
 */
function rulesOf(reasons: readonly Reason[]): ReasonRule[] {
  return [...createSet(reasons.map((item) => item.rule))].sort(compareText)
}

/**
 * Zero of every verdict.
 *
 * @returns The counts, all zero
 */
function emptyCounts(): Record<Verdict, number> {
  return fromEntries(values(Verdict).map((verdict) => [verdict, 0])) as Record<Verdict, number>
}

/**
 * Compares one task Nx selected with the owned skip of the same task: every Nx reason must be
 * answered by an owned skip reason starting from the file it cites.
 *
 * @param task - The task id
 * @param nx - Nx's reasons
 * @param skipped - The owned skip decision
 * @returns The comparison, explained or unexplained
 */
function compareNarrower(task: string, nx: readonly NxReason[], skipped: TaskDecision): TaskComparison {
  const byFile = createMap<string, Reason[]>()
  for (const item of skipped.reasons) {
    if (item.file !== null) byFile.set(item.file, [...(byFile.get(item.file) ?? []), item])
  }
  const owned: Reason[] = []
  const unanswered: NxReason[] = []
  const seen = createSet<Reason>()
  for (const item of nx) {
    const answers = item.file === undefined ? [] : (byFile.get(item.file) ?? [])
    if (answers.length === 0) unanswered.push(item)
    for (const answer of answers) {
      if (!seen.has(answer)) {
        seen.add(answer)
        owned.push(answer)
      }
    }
  }
  return {
    task,
    verdict: unanswered.length === 0 ? Verdict.NarrowerExplained : Verdict.NarrowerUnexplained,
    nx,
    owned,
    unanswered,
    rules: rulesOf(owned),
    documented: false,
  }
}

/**
 * Compares the tasks of one target.
 *
 * @param explanation - What Nx selected and why
 * @param owned - What the owned analysis decided for the target
 * @returns The comparison of every task either side knows
 */
export function compareTarget(explanation: NxExplanation, owned: AffectedSet): TargetComparison {
  const nxTasks = affectedTasks(explanation, owned.target)
  const selected = createMap(owned.selected.map((decision) => [decision.task, decision]))
  const skipped = createMap(owned.skipped.map((decision) => [decision.task, decision]))
  const ids = [...createSet([...nxTasks, ...selected.keys(), ...skipped.keys()])].sort(compareText)
  const tasks = ids.map((task): TaskComparison => {
    const nx = explanation.affected[task] ?? null
    const chosen = selected.get(task)
    if (chosen !== undefined) {
      const rules = rulesOf(chosen.reasons)
      return {
        task,
        verdict: nx === null ? Verdict.Wider : Verdict.Agree,
        nx: nx ?? [],
        owned: chosen.reasons,
        unanswered: [],
        rules,
        documented: nx === null && rules.every((rule) => DOCUMENTED_WIDER_RULES.includes(rule)),
      }
    }
    const left = skipped.get(task)
    if (nx === null) {
      return { task, verdict: Verdict.BothSkipped, nx: [], owned: [], unanswered: [], rules: [], documented: false }
    }
    if (left === undefined) return { task, verdict: Verdict.NxOnly, nx, owned: [], unanswered: nx, rules: [], documented: false }
    return compareNarrower(task, nx, left)
  })
  const counts = emptyCounts()
  for (const task of tasks) counts[task.verdict] += 1
  return { target: owned.target, nxSelected: nxTasks.length, ownedSelected: selected.size, tasks, counts }
}

/**
 * Compares every target of a range.
 *
 * @param explanation - What Nx selected and why
 * @param owned - The owned affected set of each target, as `selectAffected` returns them
 * @param targets - The targets to compare, in the order they are reported
 * @returns One comparison per target the owned analysis decided
 */
export function compareTargets(
  explanation: NxExplanation,
  owned: ReadonlyMap<string, AffectedSet>,
  targets: readonly string[]
): TargetComparison[] {
  return targets.flatMap((target) => {
    const set = owned.get(target)
    return set === undefined ? [] : [compareTarget(explanation, set)]
  })
}

/**
 * The tasks of a range under one verdict.
 *
 * @param range - The range whose tasks are filtered
 * @param verdict - The verdict wanted
 * @returns The tasks with their target, in target then task order
 */
export function tasksUnder(range: RangeComparison, verdict: Verdict): TaskComparison[] {
  return range.targets.flatMap((target) => target.tasks.filter((task) => task.verdict === verdict))
}

/**
 * The totals of every verdict over several ranges.
 *
 * @param ranges - The ranges compared
 * @returns How many tasks fell under each verdict, all ranges and targets added up
 */
export function totalCounts(ranges: readonly RangeComparison[]): VerdictCounts {
  const counts = emptyCounts()
  for (const range of ranges) {
    for (const target of range.targets) {
      for (const verdict of values(Verdict)) counts[verdict] += target.counts[verdict]
    }
  }
  return counts
}

/**
 * The build tasks to rebuild at both revisions: those the owned analysis would have skipped and
 * Nx ran, taken from the ranges in turn so the sample spans the history rather than one merge,
 * and each task once before any task is taken again, so the sample spans the projects as well.
 *
 * @param ranges - The ranges compared
 * @param count - How many to take
 * @param eligible - Whether a task may be rebuilt, given its id
 * @returns At most `count` candidates
 */
export function sampleRebuilds(ranges: readonly RangeComparison[], count: number, eligible: (task: string) => boolean): RebuildCandidate[] {
  const queues = ranges.map((range) =>
    tasksUnder(range, Verdict.NarrowerExplained)
      .filter((task) => task.task.endsWith(':build') && eligible(task.task))
      .map((task): RebuildCandidate => ({ label: range.label, base: range.base, head: range.head, task: task.task }))
  )
  const picked: RebuildCandidate[] = []
  const taken = createSet<RebuildCandidate>()
  const tasks = createSet<string>()
  for (const repeats of [false, true]) {
    for (let index = 0; picked.length < count && queues.some((queue) => index < queue.length); index += 1) {
      for (const queue of queues) {
        const candidate = queue[index]
        if (candidate === undefined || taken.has(candidate) || picked.length >= count || (!repeats && tasks.has(candidate.task))) continue
        picked.push(candidate)
        taken.add(candidate)
        tasks.add(candidate.task)
      }
    }
  }
  return picked
}
