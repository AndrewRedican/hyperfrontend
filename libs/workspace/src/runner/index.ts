/**
 * The task runner as a library: run one task, plan and run many in stages behind a progress view, and find the executor or generator a name means.
 *
 * @module @hyperfrontend/workspace/runner
 */

export type { MatrixTask } from '../progress/matrix'
export type { Identified, StagedOptions, StagedRun, StagedTask } from '../progress/stages'
export type { ProgressSink, Terminal } from '../progress/terminal'
export type { ProgressView, TaskEnd, ViewOptions, ViewTask } from '../progress/view'
export type {
  Executor,
  ExecutorContext,
  ExecutorEntry,
  ExecutorResult,
  ExecutorsManifest,
  Generator,
  GeneratorEntry,
  GeneratorsManifest,
  LintSettings,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  TreeChange,
  WorkspaceConfiguration,
} from './contract'
export type { ExecutorFunction, ExecutorModule, ExecutorSchema, ExecutorSource, ImportModule, SchemaProperty } from './executors'
export type { GeneratorSource } from './generators'
export type { AffectedRequest, ManyHost, ManyRequest, PlannedTask, TaskOutcome, TaskRef } from './many'
export type { RunHost } from './run'
export type { StartedAs } from './self'
export { EXCERPT_LINES, failureExcerpt, formatDuration, taskLogPath } from '../progress/log'
export { Ending, ENDINGS, markOf, matrixLines } from '../progress/matrix'
export { assignStages, runStages } from '../progress/stages'
export { createTerminal, Style } from '../progress/terminal'
export { createProgressView } from '../progress/view'
export { loadExecutor, locateExecutor, withDefaults } from './executors'
export { ENGINE_PACKAGE, generatorNames, loadGenerator, locateGenerator, runGenerator } from './generators'
export { manySummary, parseAffectedArgs, parseManyArgs, planMany, planTasks, runPlanned } from './many'
export { main, runTask } from './run'
export { selfCommand } from './self'
