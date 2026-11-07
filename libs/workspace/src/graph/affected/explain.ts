/**
 * The text an affected set is shown as: the selected task ids alone, or the full explanation with
 * every reason, the skipped tasks and the fallbacks that fired.
 *
 * @module graph/affected/explain
 */

import type { AffectedSet, Reason, TaskDecision } from '../selection'

/** How an affected set is printed. */
export type ExplainMode = 'tasks' | 'explain'

/**
 * The lines describing one reason: the rule, the file and the sentence, then the path followed.
 *
 * @param item - The reason described
 * @returns One or two lines
 *
 * @example A reason with and without a path
 * ```typescript
 * describeReason({ rule: 'changed-input', file: 'libs/a/src/x.ts', path: [], message: 'libs/a/src/x.ts is an input of lib-a:build (production file of lib-a)' })
 * // => ['changed-input libs/a/src/x.ts: libs/a/src/x.ts is an input of lib-a:build (production file of lib-a)']
 * describeReason({ rule: 'dependent-task', file: null, path: ['task:lib-a:build'], message: 'lib-a:test runs after lib-a:build, which is selected' })
 * // => ['dependent-task: lib-a:test runs after lib-a:build, which is selected', '  via task:lib-a:build']
 * ```
 */
export function describeReason(item: Reason): string[] {
  const head = `${item.rule}${item.file === null ? '' : ` ${item.file}`}: ${item.message}`
  return item.path.length === 0 ? [head] : [head, `  via ${item.path.join(' → ')}`]
}

/**
 * The lines describing one task's decision.
 *
 * @param decision - The task's decision
 * @returns The task id, then its reasons indented
 */
function describeDecision(decision: TaskDecision): string[] {
  return [decision.task, ...decision.reasons.flatMap(describeReason).map((line) => `    ${line}`)]
}

/**
 * The heading of an affected set.
 *
 * @param set - The set summarised
 * @returns One line with the target, the counts and the range
 */
function heading(set: AffectedSet): string {
  const total = set.selected.length + set.skipped.length
  const range = `${set.changes.base.slice(0, 12)} → ${set.changes.head === null ? 'working tree' : set.changes.head.slice(0, 12)}`
  return `${set.target}: ${set.selected.length} of ${total} tasks selected, ${set.changes.changes.length} changed files, ${range}`
}

/**
 * The lines an affected set prints as.
 *
 * @param set - The decisions of one target
 * @param mode - The selected ids alone, or the explanation
 * @returns The lines
 *
 * @example The task ids alone, ready for a runner
 * ```typescript
 * const graph = workspaceGraph(root)
 * const changes = changeSet(root, 'main', null)
 * const sets = selectAffected({ graph, changes, targets: ['test'], previous: previousGraph(root, changes) })
 * formatAffected(sets.get('test')!, 'tasks') // => ['lib-features:test', 'lib-nexus:test']
 * ```
 *
 * @example The full explanation
 * ```typescript
 * formatAffected(sets.get('test')!, 'explain').join('\n')
 * // test: 2 of 14 tasks selected, 3 changed files, a1b2c3d4e5f6 → working tree
 * //   lib-nexus:test
 * //       changed-input libs/nexus/src/core/registry.ts: libs/nexus/src/core/registry.ts is an input of lib-nexus:test (production file of lib-nexus)
 * //   ...
 * // skipped 12 tasks
 * //   lib-builder:test
 * //       unreachable libs/nexus/src/core/registry.ts: ... lib-builder does not depend on lib-nexus
 * ```
 */
export function formatAffected(set: AffectedSet, mode: ExplainMode): string[] {
  if (mode === 'tasks') return set.selected.map((decision) => decision.task)
  const lines = [heading(set), ...set.selected.flatMap((decision) => describeDecision(decision).map((line) => `  ${line}`))]
  if (set.skipped.length > 0)
    lines.push(
      `skipped ${set.skipped.length} tasks`,
      ...set.skipped.flatMap((decision) => describeDecision(decision).map((line) => `  ${line}`))
    )
  if (set.fallbacks.length > 0)
    lines.push(`fallbacks (${set.fallbacks.length})`, ...set.fallbacks.flatMap(describeReason).map((line) => `  ${line}`))
  return lines
}

/**
 * The lines explaining one task of an affected set.
 *
 * @param set - The affected set
 * @param task - The task id, `<project>:<target>`
 * @returns The decision with its reasons, or one line saying the target has no such task
 *
 * @example Why one task was skipped
 * ```typescript
 * formatTask(sets.get('test')!, 'lib-builder:test')
 * // => ['lib-builder:test is skipped', '    unreachable libs/nexus/src/core/registry.ts: ...']
 * formatTask(sets.get('test')!, 'docs-site:test') // => ['docs-site:test is not a task of test']
 * ```
 */
export function formatTask(set: AffectedSet, task: string): string[] {
  const selected = set.selected.find((decision) => decision.task === task)
  if (selected !== undefined) return [`${task} is selected`, ...describeDecision(selected).slice(1)]
  const skipped = set.skipped.find((decision) => decision.task === task)
  if (skipped !== undefined) return [`${task} is skipped`, ...describeDecision(skipped).slice(1)]
  return [`${task} is not a task of ${set.target}`]
}
