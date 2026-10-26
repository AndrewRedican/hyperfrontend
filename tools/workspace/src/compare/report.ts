/**
 * The Markdown report of a comparison: the totals, one row per range and target, every category
 * (c) task with the Nx reasons left unanswered, every category (b) task with its rules, category
 * (a) by rule, the tasks Nx alone knows, and the rebuilds that checked skipped builds for drift.
 *
 * @module compare/report
 */

import type { NxReason } from '../baseline/model'
import type { Reason } from '../graph/selection'
import type { RangeComparison, RebuildCandidate, TaskComparison } from './classify'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { compareText } from '../graph/order'
import { tasksUnder, totalCounts, Verdict } from './classify'

/** What a rebuild of a skipped build task at both revisions found. */
export const RebuildOutcome = freeze({
  /** The two `dist` trees hold the same bytes. */
  Identical: 'identical',
  /** At least one file differs or exists on one side alone. */
  Different: 'different',
  /** The rebuild could not run at one of the revisions. */
  Skipped: 'skipped',
} as const)

/** One of the rebuild outcomes. */
export type RebuildOutcome = (typeof RebuildOutcome)[keyof typeof RebuildOutcome]

/** One rebuild's result. */
export interface RebuildResult {
  /** The task and range rebuilt. */
  readonly candidate: RebuildCandidate
  /** What the rebuild found. */
  readonly outcome: RebuildOutcome
  /** The files that differ, or why the rebuild was skipped. */
  readonly detail: string
}

/** Everything the report renders. */
export interface ComparisonReport {
  /** When the comparison ran, ISO 8601. */
  readonly generatedAt: string
  /** The targets compared. */
  readonly targets: readonly string[]
  /** The ranges compared. */
  readonly ranges: readonly RangeComparison[]
  /** The rebuilds run. */
  readonly rebuilds: readonly RebuildResult[]
  /** Notes the comparison added, one paragraph each. */
  readonly notes: readonly string[]
}

/** How many explained skips rest on one rule, with an example. */
interface RuleTally {
  /** How many tasks the rule explained. */
  tasks: number
  /** One task and the sentence the rule produced for it. */
  readonly example: string
}

/** How many characters of a revision are shown. */
const SHORT = 12

/**
 * One Nx reason as a reader sees it.
 *
 * @param item - The reason Nx gave
 * @returns The kind, the file and what else the reason carries
 */
export function describeNxReason(item: NxReason): string {
  const parts = [item.kind, item.file ?? '(no file)']
  if (item.pattern !== undefined) parts.push(`matching ${item.pattern}`)
  if (item.package !== undefined) parts.push(`package ${item.package}`)
  if (item.producer !== undefined) parts.push(`from ${item.producer}`)
  return parts.join(' ')
}

/**
 * Text safe inside a table cell.
 *
 * @param text - The cell's content
 * @returns The content with pipes escaped
 */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

/**
 * A Markdown table.
 *
 * @param header - The column names
 * @param rows - The rows, each as many cells as the header
 * @returns The table's lines
 */
function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ]
}

/**
 * A range's label with its revisions.
 *
 * @param range - The range named
 * @returns The label, then `base → head` shortened
 */
function nameOf(range: RangeComparison): string {
  return `${range.label} (${range.base.slice(0, SHORT)} → ${range.head.slice(0, SHORT)})${range.lockfileSkew ? ' ⚠ lock-file skew' : ''}`
}

/**
 * The per-range, per-target rows.
 *
 * @param ranges - The ranges compared
 * @returns The table's lines
 */
function rangeTable(ranges: readonly RangeComparison[]): string[] {
  const rows = ranges.flatMap((range) =>
    range.targets.map((target) => [
      nameOf(range),
      String(range.changedFiles),
      target.target,
      String(target.nxSelected),
      String(target.ownedSelected),
      String(target.counts.agree),
      String(target.counts['narrower-explained']),
      String(target.counts.wider),
      String(target.counts['narrower-unexplained']),
      String(target.counts['nx-only']),
    ])
  )
  return table(['Range', 'Files', 'Target', 'Nx', 'Owned', 'Agree', '(a)', '(b)', '(c)', 'Nx only'], rows)
}

/**
 * The category (c) section: every task Nx selected whose skip the owned analysis cannot answer.
 *
 * @param ranges - The ranges compared
 * @returns The section's lines
 */
function unexplainedSection(ranges: readonly RangeComparison[]): string[] {
  const lines = ['## Category (c): narrower without a reason', '']
  const found = ranges.flatMap((range) => tasksUnder(range, Verdict.NarrowerUnexplained).map((task) => [range, task] as const))
  if (found.length === 0) return [...lines, 'None.', '']
  for (const [range, task] of found) {
    lines.push(`- **${task.task}** in ${nameOf(range)}`)
    for (const item of task.unanswered) lines.push(`  - unanswered: ${describeNxReason(item)}`)
    // why: an answered reason was matched by the file Nx cited, so it always names one.
    for (const item of task.owned) lines.push(`  - answered: ${item.rule} ${item.file as string}: ${item.message}`)
  }
  return [...lines, '']
}

/**
 * The category (b) section: every task the owned analysis selected and Nx did not.
 *
 * @param ranges - The ranges compared
 * @returns The section's lines
 */
function widerSection(ranges: readonly RangeComparison[]): string[] {
  const lines = ['## Category (b): wider', '']
  const rows = ranges.flatMap((range) =>
    tasksUnder(range, Verdict.Wider).map((task) => [
      nameOf(range),
      task.task,
      task.rules.join(', '),
      task.documented ? 'yes' : 'no',
      (task.owned[0] as Reason).message,
    ])
  )
  if (rows.length === 0) return [...lines, 'None.', '']
  return [...lines, ...table(['Range', 'Task', 'Rules', 'Documented', 'First reason'], rows), '']
}

/**
 * The category (a) section: how many skips rest on each rule, with an example of each.
 *
 * @param ranges - The ranges compared
 * @returns The section's lines
 */
function explainedSection(ranges: readonly RangeComparison[]): string[] {
  const lines = ['## Category (a): narrower with a reason, by rule', '']
  const byRule = createMap<string, RuleTally>()
  for (const range of ranges) {
    for (const task of tasksUnder(range, Verdict.NarrowerExplained)) {
      for (const rule of task.rules) {
        const known = byRule.get(rule)
        if (known === undefined) {
          const first = task.owned.find((item) => item.rule === rule)
          byRule.set(rule, { tasks: 1, example: `${task.task}: ${(first as Reason).message}` })
        } else known.tasks += 1
      }
    }
  }
  if (byRule.size === 0) return [...lines, 'None.', '']
  const rows = [...byRule]
    .sort(([left], [right]) => compareText(left, right))
    .map(([rule, item]) => [rule, String(item.tasks), item.example])
  return [...lines, ...table(['Rule', 'Tasks', 'Example'], rows), '']
}

/**
 * The tasks Nx selected that the owned graph has no task for, counted by target.
 *
 * @param ranges - The ranges compared
 * @returns The section's lines
 */
function nxOnlySection(ranges: readonly RangeComparison[]): string[] {
  const lines = ['## Tasks Nx alone knows', '']
  const byTarget = createMap<string, TaskComparison[]>()
  for (const range of ranges) {
    for (const target of range.targets) {
      const own = target.tasks.filter((task) => task.verdict === Verdict.NxOnly)
      if (own.length > 0) byTarget.set(target.target, [...(byTarget.get(target.target) ?? []), ...own])
    }
  }
  if (byTarget.size === 0) return [...lines, 'None.', '']
  const rows = [...byTarget].map(([target, tasks]) => [target, String(tasks.length), (tasks[0] as TaskComparison).task])
  return [...lines, ...table(['Target', 'Selections', 'Example'], rows), '']
}

/**
 * The section tallying the rebuilt tasks and listing each outcome.
 *
 * @param rebuilds - The rebuilds run
 * @returns The section's lines
 */
function rebuildSection(rebuilds: readonly RebuildResult[]): string[] {
  const lines = ['## Rebuilds of skipped build tasks', '']
  if (rebuilds.length === 0) return [...lines, 'None run.', '']
  const identical = rebuilds.filter((item) => item.outcome === RebuildOutcome.Identical).length
  const rows = rebuilds.map((item) => [item.candidate.label, item.candidate.task, item.outcome, item.detail])
  return [
    ...lines,
    `${identical} of ${rebuilds.length} rebuilt tasks produced byte-identical output at both revisions.`,
    '',
    ...table(['Range', 'Task', 'Outcome', 'Detail'], rows),
    '',
  ]
}

/**
 * Renders a comparison as a Markdown document.
 *
 * @param report - What to render
 * @returns The document
 */
export function renderReport(report: ComparisonReport): string {
  const totals = totalCounts(report.ranges)
  const wider = report.ranges.flatMap((range) => tasksUnder(range, Verdict.Wider))
  const documented = wider.filter((task) => task.documented).length
  const skewed = report.ranges.filter((range) => range.lockfileSkew)
  const lines = [
    '# Affected comparison',
    '',
    `Generated ${report.generatedAt}. ${report.ranges.length} range${report.ranges.length === 1 ? '' : 's'}, targets ${report.targets.join(', ')}.`,
    '',
    'Each task of each target is decided twice, by Nx and by the owned analysis. Category (a) is a task Nx selected that the owned analysis skipped with a named rule for every file Nx cites; (b) a task the owned analysis selected and Nx did not; (c) a task Nx selected that the owned analysis skipped without answering one of its reasons.',
    '',
    ...table(
      ['Agree', '(a)', '(b)', '(b) documented', '(c)', 'Nx only', 'Both skipped'],
      [
        [
          String(totals.agree),
          String(totals['narrower-explained']),
          String(totals.wider),
          `${documented} of ${wider.length}`,
          String(totals['narrower-unexplained']),
          String(totals['nx-only']),
          String(totals['both-skipped']),
        ],
      ]
    ),
    '',
    totals['narrower-unexplained'] === 0
      ? '**No category (c) task.** Every narrower decision names a rule for every file Nx cites.'
      : `**${totals['narrower-unexplained']} category (c) task${totals['narrower-unexplained'] === 1 ? '' : 's'}.** Listed below with the Nx reasons left unanswered.`,
    '',
    '## Ranges',
    '',
    ...rangeTable(report.ranges),
    '',
    ...unexplainedSection(report.ranges),
    ...widerSection(report.ranges),
    ...explainedSection(report.ranges),
    ...nxOnlySection(report.ranges),
    ...rebuildSection(report.rebuilds),
  ]
  if (skewed.length > 0) {
    lines.push(
      '## Lock-file skew',
      '',
      'The Nx capture of these ranges ran against a `node_modules` installed from a later lock file, so Nx read the installed versions of today while the owned analysis read the lock file of the revision.',
      '',
      ...skewed.map((range) => `- ${nameOf(range)}`),
      ''
    )
  }
  if (report.notes.length > 0) lines.push('## Notes', '', ...report.notes.flatMap((note) => [note, '']))
  return `${lines.join('\n').trimEnd()}\n`
}
