/**
 * What a plan and a run look like to a reader: the plan summary with every chain, every task's
 * reasons and every skip, the run summary with the totals, the task table and a Mermaid timeline,
 * and the table a chain's check run shows.
 *
 * @module pipeline/report
 */

import type { Chain, Outcome as OutcomeKind, Plan, PlanReason, PlanTask, RunResults, SkippedTask, TaskResult } from './model'
import type { ScheduleResult } from './schedule'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max, round, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { Outcome } from './model'

/** The mark of each outcome in a table. */
const MARKS: Readonly<Record<OutcomeKind, string>> = { success: '✅', failure: '❌', skipped: '⏭️', cancelled: '🚫' }

/** The Mermaid tag of each outcome; a skipped task never ran, so it never draws a bar. */
const TAGS: Readonly<Record<OutcomeKind, string>> = { success: 'done', failure: 'crit', cancelled: 'active', skipped: 'done' }

/**
 * A duration as a reader sees it.
 *
 * @param ms - Milliseconds
 * @returns `18m 17s`, `47s` or `0.8s`
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 10) return `${round(seconds * 10) / 10}s`
  if (seconds < 60) return `${round(seconds)}s`
  const minutes = trunc(seconds / 60)
  return `${minutes}m ${round(seconds - minutes * 60)}s`
}

/** How many lines of a failed task's output the reports show. */
export const EXCERPT_LINES = 60

/**
 * The part of a failed task's output that explains the failure: from the test runner's list of
 * failing tests up to its coverage table when it printed one, else the last lines.
 *
 * @param log - Everything the task printed
 * @param limit - The most lines kept
 * @returns The lines, or null when the task printed nothing
 */
export function failureExcerpt(log: string, limit: number = EXCERPT_LINES): string | null {
  const lines = log.replace(/\s+$/, '').split(/\r?\n/)
  if (lines.length === 1 && lines[0] === '') return null
  const failing = lines.findIndex((line) => /failing tests:\s*$/.test(line))
  if (failing === -1) return lines.slice(max(0, lines.length - limit)).join('\n')
  const coverage = lines.findIndex((line, index) => index > failing && /^file\s+\|/.test(line))
  return lines
    .slice(failing, coverage === -1 ? undefined : coverage)
    .slice(0, limit)
    .join('\n')
}

/**
 * A task's result from what the scheduler recorded, with the excerpt of its log when it failed.
 *
 * @param task - The planned task
 * @param result - What the scheduler recorded for it
 * @param readLog - Reads a log file by its workspace-relative path
 * @returns The result as the run file records it
 */
export function taskResult(task: PlanTask, result: ScheduleResult, readLog: (path: string) => string): TaskResult {
  const { id, project, target, environment, reasons } = task
  const { outcome, exitCode, detail, startedAt, endedAt, durationMs, log } = result
  const ended: TaskResult = { id, project, target, environment, reasons, outcome, exitCode, detail, startedAt, endedAt, durationMs, log }
  const excerpt = outcome === Outcome.Failure && log !== null ? failureExcerpt(readLog(log)) : null
  return excerpt === null ? ended : { ...ended, excerpt }
}

/**
 * Text as a workflow command carries it on one line.
 *
 * @param text - Any text
 * @param property - Whether it is a property value, which also escapes `:` and `,`
 * @returns The escaped text
 */
function commandText(text: string, property: boolean): string {
  const escaped = text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  return property ? escaped.replace(/:/g, '%3A').replace(/,/g, '%2C') : escaped
}

/**
 * The error annotation of a failed task, which the run page lists with the excerpt.
 *
 * @param id - The task id
 * @param excerpt - What the task printed that explains the failure
 * @returns The workflow command
 */
export function errorAnnotation(id: string, excerpt: string): string {
  return `::error title=${commandText(`${id} failed`, true)}::${commandText(excerpt, false)}`
}

/**
 * The failed tasks with the excerpt of each, folded open, for a summary or a check run.
 *
 * @param results - The tasks
 * @returns The lines, or none when no task carries an excerpt
 */
export function failureLines(results: readonly TaskResult[]): string[] {
  const failed = results.filter((task) => task.excerpt !== undefined)
  if (failed.length === 0) return []
  return [
    '### Failures',
    '',
    ...failed.flatMap((task) => [
      `<details open><summary><code>${task.id}</code></summary>`,
      '',
      '````text',
      task.excerpt as string,
      '````',
      '',
      '</details>',
      '',
    ]),
  ]
}

/**
 * Text safe inside a table cell.
 *
 * @param text - Any text
 * @returns The text with backslashes and pipes escaped and newlines replaced
 */
function cell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/**
 * One reason as a reader sees it.
 *
 * @param reason - The reason described
 * @returns The rule, the file and the sentence, then the path when there is one
 */
export function describePlanReason(reason: PlanReason): string {
  const head = `${reason.rule}${reason.file === null ? '' : ` ${reason.file}`}: ${reason.message}`
  return reason.path.length === 0 ? head : `${head} (via ${reason.path.join(' → ')})`
}

/**
 * The range a plan covers.
 *
 * @param plan - The plan whose range is read
 * @returns `all` or `<base> → <head>`
 */
function rangeOf(plan: Plan): string {
  if (plan.mode === 'all') return 'every project, every target'
  return `${plan.base.slice(0, 12)} → ${plan.head === null ? 'working tree' : plan.head.slice(0, 12)}`
}

/**
 * The lines of a skipped decision.
 *
 * @param decision - A task the plan left out
 * @returns The task and its reasons
 */
function skippedLines(decision: SkippedTask): string[] {
  return [`- \`${decision.task}\``, ...decision.reasons.map((reason) => `  - ${describePlanReason(reason)}`)]
}

/**
 * The Markdown summary of a plan.
 *
 * @param plan - The plan summarised
 * @returns The lines
 */
export function planSummary(plan: Plan): string[] {
  const tasks = plan.chains.reduce((count, chain) => count + chain.tasks.length, 0)
  const counts = plan.environments
    .map((environment) => `${plan.chains.filter((chain) => chain.environment === environment).length} ${environment}`)
    .join(', ')
  const lines = [
    '## Pipeline plan',
    '',
    `${plan.mode === 'all' ? 'Full' : 'Affected'} plan (${rangeOf(plan)}): ${plan.chains.length} chains (${counts}), ${tasks} tasks${plan.main ? ', publishing' : ''}.`,
  ]
  if (plan.drift.length > 0) lines.push('', `Registry drift: ${plan.drift.join(', ')}.`)
  if (plan.chains.length === 0) return [...lines, '', 'Nothing to run.']
  lines.push('', '| # | chain | environment | tasks |', '| --- | --- | --- | --- |')
  for (const chain of plan.chains)
    lines.push(
      `| ${chain.order} | ${chain.project} | ${chain.environment} | ${chain.tasks.map((task) => `\`${task.target}\``).join(' ')} |`
    )
  lines.push('', '<details><summary>Why each task runs</summary>', '')
  for (const chain of plan.chains) {
    lines.push(`- **${chain.project} (${chain.environment})**`)
    for (const task of chain.tasks) {
      const needs = task.needs.length === 0 ? '' : ` after ${task.needs.join(', ')}`
      lines.push(`  - \`${task.id}\`${needs}`, ...task.reasons.map((reason) => `    - ${describePlanReason(reason)}`))
    }
  }
  lines.push('', '</details>')
  if (plan.skipped.length > 0)
    lines.push(
      '',
      `<details><summary>Skipped tasks (${plan.skipped.length})</summary>`,
      '',
      ...plan.skipped.flatMap(skippedLines),
      '',
      '</details>'
    )
  return lines
}

/**
 * The totals of a run.
 *
 * @param results - The run
 * @returns One sentence
 */
export function totalsLine(results: RunResults): string {
  const by = createMap<string, number>()
  for (const task of results.tasks) by.set(task.outcome, (by.get(task.outcome) ?? 0) + 1)
  const busy = results.tasks.reduce((sum, task) => sum + task.durationMs, 0)
  const parts = [Outcome.Success, Outcome.Failure, Outcome.Skipped, Outcome.Cancelled]
    .filter((outcome) => by.has(outcome))
    .map((outcome) => `${by.get(outcome)} ${outcome}`)
  return `${results.tasks.length} tasks (${parts.join(', ')}), wall-clock ${formatDuration(results.durationMs)}, runner time ${formatDuration(busy)}.`
}

/**
 * The rows of a task table.
 *
 * @param results - The tasks
 * @param withChain - Whether a chain column leads
 * @returns The lines
 */
function taskRows(results: readonly TaskResult[], withChain: boolean): string[] {
  return results.map((task) => {
    const columns = [
      `${MARKS[task.outcome]} ${task.outcome}`,
      task.startedAt === null ? '' : formatDuration(task.durationMs),
      cell(task.detail ?? ''),
    ]
    return `| ${withChain ? `${task.project} | ` : ''}\`${task.id}\` | ${columns.join(' | ')} |`
  })
}

/**
 * The table a chain's check run shows.
 *
 * @param chain - The chain shown
 * @param results - Its results
 * @returns The lines
 */
export function chainTable(chain: Chain, results: readonly TaskResult[]): string[] {
  return [
    `${chain.project} on ${chain.environment}, ${results.length} tasks.`,
    '',
    '| task | outcome | duration | detail |',
    '| --- | --- | --- | --- |',
    ...taskRows(results, false),
  ]
}

/**
 * The Mermaid timeline of a run: one section per chain, one bar per task that ran.
 *
 * @param results - The run
 * @param plan - The plan the run executed
 * @returns The lines, fenced
 */
export function timelineLines(results: RunResults, plan: Plan): string[] {
  const lines = ['```mermaid', 'gantt', `  title ${results.environment}`, '  dateFormat x', '  axisFormat %H:%M:%S']
  for (const chain of plan.chains) {
    if (chain.environment !== results.environment) continue
    const ran = results.tasks.filter((task) => task.project === chain.project && task.startedAt !== null)
    if (ran.length === 0) continue
    lines.push(`  section ${chain.project}`)
    for (const task of ran)
      lines.push(`  ${task.target} (${formatDuration(task.durationMs)}) :${TAGS[task.outcome]}, ${task.startedAt}, ${task.endedAt}`)
  }
  return [...lines, '```']
}

/**
 * The Markdown summary of a run.
 *
 * @param results - The run summarised
 * @param plan - The plan the run executed, or null when it is not at hand, which leaves the timeline out
 * @returns The lines
 */
export function runSummary(results: RunResults, plan: Plan | null): string[] {
  return [
    `## Pipeline run (${results.environment})`,
    '',
    totalsLine(results),
    '',
    '| chain | task | outcome | duration | detail |',
    '| --- | --- | --- | --- | --- |',
    ...taskRows(results.tasks, true),
    '',
    ...failureLines(results.tasks),
    ...(plan === null ? [] : timelineLines(results, plan)),
  ]
}
