/**
 * What executors and generators are written against: the context an executor is called with,
 * the configuration it reads there, the tree a generator edits, and the manifests that list
 * both.
 *
 * @module runner/contract
 */

/** A target, as `project.json` and the `targetDefaults` of `hf.json` write it. */
export interface TargetConfiguration<Options = Record<string, unknown>> {
  /** The executor, `<package>:<name>`. */
  executor?: string
  /** A shell command, the short form of a `run-commands` target. */
  command?: string
  /** The options the executor is called with. */
  options?: Options
  /** The inputs whose change selects the target. */
  inputs?: readonly unknown[]
  /** The tasks the target runs after. */
  dependsOn?: readonly unknown[]
  /** Free-form metadata. */
  metadata?: Readonly<Record<string, unknown>>
}

/** A project's configuration, as an executor reads it. */
export interface ProjectConfiguration {
  /** The project's name. */
  name?: string
  /** The project's root, workspace-relative and POSIX. */
  root: string
  /** The source root. */
  sourceRoot?: string
  /** `application` or `library`. */
  projectType?: 'application' | 'library'
  /** The tags. */
  tags?: string[]
  /** The projects this one depends on without importing them. */
  implicitDependencies?: string[]
  /** The targets by name. */
  targets?: Record<string, TargetConfiguration>
  /** Free-form metadata. */
  metadata?: Readonly<Record<string, unknown>>
}

/** The workspace configuration, as `hf.json` writes it. */
export interface WorkspaceConfiguration {
  /** The defaults of each target, by executor or by target name. */
  targetDefaults?: Record<string, TargetConfiguration>
  /** The named inputs. */
  namedInputs?: Record<string, readonly unknown[]>
  /** The inferred `lint` target's settings. */
  lint?: LintSettings
}

/** The settings of the `lint` target the workspace infers for its projects. */
export interface LintSettings {
  /** The command the inferred target runs from a project's root; `{workspaceRoot}` in it is the path from there to the workspace root. Defaults to `hf-lint .`. */
  command?: string
  /** The project files whose projects get no inferred target, as globs. */
  exclude?: string[]
}

/** What an executor is called with besides its options. */
export interface ExecutorContext {
  /** The workspace root, absolute. */
  root: string
  /** The directory the command line started in. */
  cwd: string
  /** The project the task runs on. */
  projectName: string
  /** The target the task runs. */
  targetName: string
  /** The target, merged with its defaults and its tokens replaced. */
  target: TargetConfiguration
  /** Every project's configuration by name, targets resolved. */
  projects: Record<string, ProjectConfiguration>
  /** The workspace configuration. */
  configuration: WorkspaceConfiguration
}

/** What an executor answers. */
export interface ExecutorResult {
  /** Whether the task succeeded. */
  success: boolean
}

/** An executor: the default export of the module an executors manifest names. */
export type Executor<Options = Record<string, unknown>> = (
  options: Options,
  context: ExecutorContext
) => Promise<ExecutorResult> | ExecutorResult

/** One executor of an executors manifest. */
export interface ExecutorEntry {
  /** The module whose default export implements it, relative to the manifest. */
  implementation: string
  /** The schema of its options, relative to the manifest. */
  schema: string
  /** What it does. */
  description?: string
}

/** A package's `executors.json`. */
export interface ExecutorsManifest {
  /** The executors by name. */
  executors?: Record<string, ExecutorEntry>
}

/** One generator of a generators manifest. */
export interface GeneratorEntry {
  /** The module whose default export implements it, relative to the manifest. */
  factory: string
  /** The schema of its options, relative to the manifest. */
  schema: string
  /** What it does. */
  description?: string
}

/** A package's `generators.json`. */
export interface GeneratorsManifest {
  /** The generators by name. */
  generators?: Record<string, GeneratorEntry>
}

/** One change a tree has recorded since it was opened. */
export interface TreeChange {
  /** The path, relative to the tree's root, POSIX. */
  readonly path: string
  /** What happened to the file. */
  readonly type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** The content written, or nothing for a deletion. */
  readonly content?: Buffer | null
}

/** A virtual file tree: reads fall through to the files, writes are recorded until committed. */
export interface Tree {
  /** The directory every path is relative to, absolute. */
  readonly root: string
  /** The content of a file, or null when there is none. */
  read(path: string): Buffer | null
  /** The text of a file, or null when there is none. */
  read(path: string, encoding: 'utf-8'): string | null
  /** Records a file's content. */
  write(path: string, content: Buffer | string): void
  /** Whether a file or directory is there. */
  exists(path: string): boolean
  /** Records a file's deletion. */
  delete(path: string): void
  /** Whether the path names a file. */
  isFile(path: string): boolean
  /** The names directly under a directory. */
  children(path: string): string[]
  /** Every change recorded so far. */
  listChanges(): TreeChange[]
}

/** A generator: the default export of the module a generators manifest names. */
export type Generator<Options = Record<string, unknown>> = (tree: Tree, options: Options) => unknown
