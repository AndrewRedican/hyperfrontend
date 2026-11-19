/**
 * The stages of a run and the view of it: which tasks run before which, where a failure stops
 * the run, and the lines and matrix a terminal shows. Nothing here executes a task.
 *
 * @module @hyperfrontend/workspace/progress
 */

export type { MatrixTask } from './matrix'
export type { Identified, StagedOptions, StagedRun, StagedTask } from './stages'
export type { ProgressSink, Terminal } from './terminal'
export type { ProgressView, TaskEnd, ViewOptions, ViewTask } from './view'
export { EXCERPT_LINES, failureExcerpt, formatDuration, taskLogPath } from './log'
export { Ending, ENDINGS, markOf, matrixLines } from './matrix'
export { assignStages, runStages } from './stages'
export { createTerminal, Style } from './terminal'
export { createProgressView } from './view'
