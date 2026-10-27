/**
 * What a plan and a run look like to a reader: the plan summary with every chain, every task's
 * reasons and every skip, the run summary with the totals, the task table and a Mermaid timeline,
 * and the table a chain's check run shows.
 *
 * @module pipeline/report
 */

import type { Chain, Outcome as OutcomeKind, Plan, PlanReason, RunResults, SkippedTask, TaskResult } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
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
    ...(plan === null ? [] : timelineLines(results, plan)),
  ]
}
