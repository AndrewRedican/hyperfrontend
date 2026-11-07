/**
 * The contract executors and generators are written against: the context an executor runs in, the tree a generator edits, and the configuration both read.
 *
 * @module @hyperfrontend/workspace
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
} from './runner/contract'
