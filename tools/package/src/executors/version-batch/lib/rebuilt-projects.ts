import type { TaskDecision, WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { reachedThrough } from '../../version/lib/shipped-change-commits'

/**
 * The projects whose build was selected because of a file another project owns: the ones a change
 * may make due a release although it touches none of their files.
 *
 * @param graph - The workspace graph, asked which project owns a file
 * @param decisions - The selected build tasks, each with the reasons it was selected
 * @returns The names of the projects, in the order of their tasks
 */
export function rebuiltProjects(graph: Pick<WorkspaceGraph, 'projectOf'>, decisions: readonly TaskDecision[]): string[] {
  return decisions
    .map((decision) => ({ name: decision.task.slice(0, decision.task.lastIndexOf(':')), reasons: decision.reasons }))
    .filter(({ name, reasons }) => reasons.some((reason) => reachedThrough(graph, name, reason) !== null))
    .map(({ name }) => name)
}
