/**
 * The task runner as a library: run one task, plan and run many with their prerequisites, and find the executor or generator a name means.
 *
 * @module runner
 */

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
export { loadExecutor, locateExecutor, withDefaults } from './executors'
export { ENGINE_PACKAGE, generatorNames, loadGenerator, locateGenerator, runGenerator } from './generators'
export { manySummary, parseAffectedArgs, parseManyArgs, planMany, planTasks, runPlanned } from './many'
export { main, runTask } from './run'
export { selfCommand } from './self'
