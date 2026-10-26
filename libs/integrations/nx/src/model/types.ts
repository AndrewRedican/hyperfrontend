/**
 * The workspace's own vocabulary for what Nx configures: the files as they are written and the
 * projects, targets, inputs and tasks they resolve to. Nothing here is an Nx type; the shapes are
 * the subset the workspace reads and writes.
 *
 * @module model/types
 */

/** The kind of a project, as `project.json` names it. */
export type ProjectType = 'library' | 'application'

/** A named input of the project itself, of named projects, or of the dependencies. */
export interface NamedInputReference {
  /** The named input referred to. */
  readonly input: string
  /** The projects whose named input is meant; absent for the project itself. */
  readonly projects?: string | readonly string[]
  /** Whether the dependencies' named input is meant. */
  readonly dependencies?: boolean
}

/** A file pattern a target reads. */
export interface FilesetInput {
  /** A file pattern, with `{projectRoot}` and `{workspaceRoot}` placeholders. */
  readonly fileset: string
  /** Whether the dependencies' files are meant. */
  readonly dependencies?: boolean
}

/** A command whose output is part of a target's input. */
export interface RuntimeInput {
  /** The command run. */
  readonly runtime: string
}

/** An environment variable whose value is part of a target's input. */
export interface EnvironmentInput {
  /** The variable's name. */
  readonly env: string
}

/** External packages whose versions are part of a target's input. */
export interface ExternalDependenciesInput {
  /** The package names. */
  readonly externalDependencies: readonly string[]
}

/** A named input or fileset a target depends on, in the forms the workspace writes. */
export type InputDefinition = NamedInputReference | FilesetInput | RuntimeInput | EnvironmentInput | ExternalDependenciesInput

/** One entry of a target's `inputs`: a named input by name, a pattern, or a definition. */
export type TargetInput = string | InputDefinition

/** A target that must run before another, with the projects it runs for. */
export interface TargetDependencyConfig {
  /** The target that must run first. */
  readonly target: string
  /** The projects whose target is meant. */
  readonly projects?: string | readonly string[]
  /** Whether the dependencies' target is meant. */
  readonly dependencies?: boolean
  /** Whether command-line parameters are forwarded. */
  readonly params?: 'ignore' | 'forward'
}

/** One entry of a target's `dependsOn`: a target name, or a configured dependency. */
export type TargetDependency = string | TargetDependencyConfig

/** A target as `project.json` or `nx.json#targetDefaults` writes it. */
export interface TargetDefinition {
  /** The executor that runs the target, as `<package>:<name>`. */
  readonly executor?: string
  /** The shell command run instead of an executor. */
  readonly command?: string
  /** What the target reads. */
  readonly inputs?: readonly TargetInput[]
  /** What the target writes, with placeholders. */
  readonly outputs?: readonly string[]
  /** What must run first. */
  readonly dependsOn?: readonly TargetDependency[]
  /** The options handed to the executor. */
  readonly options?: Readonly<Record<string, unknown>>
  /** Named option sets. */
  readonly configurations?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** Whether Nx may cache the target. */
  readonly cache?: boolean
}

/** A `project.json` as written. */
export interface ProjectFile {
  /** The project's name. */
  readonly name?: string
  /** What the project is for. */
  readonly description?: string
  /** The project's root, workspace-relative; inferred from the file's location when absent. */
  readonly root?: string
  /** Where its sources live, with the `{projectRoot}` placeholder. */
  readonly sourceRoot?: string
  /** The kind of project. */
  readonly projectType?: ProjectType
  /** The tags the module boundaries read. */
  readonly tags?: readonly string[]
  /** Projects depended on without an import. */
  readonly implicitDependencies?: readonly string[]
  /** Named inputs local to the project. */
  readonly namedInputs?: Readonly<Record<string, readonly TargetInput[]>>
  /** The targets, by name. */
  readonly targets?: Readonly<Record<string, TargetDefinition>>
  /** Free-form metadata the workspace rules read. */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** A plugin of `nx.json` with its options and the files it is limited to. */
export interface PluginConfig {
  /** The plugin module. */
  readonly plugin: string
  /** Its options. */
  readonly options?: Readonly<Record<string, unknown>>
  /** File patterns the plugin is limited to. */
  readonly include?: readonly string[]
  /** File patterns the plugin skips. */
  readonly exclude?: readonly string[]
}

/** A plugin entry of `nx.json`: a module name, or a configured plugin. */
export type PluginEntry = string | PluginConfig

/** The parts of `nx.json` the workspace reads. */
export interface NxJsonFile {
  /** Named inputs every project may refer to. */
  readonly namedInputs?: Readonly<Record<string, readonly TargetInput[]>>
  /** Defaults merged into every target of the same name or executor. */
  readonly targetDefaults?: Readonly<Record<string, TargetDefinition>>
  /** The plugins that infer projects and targets. */
  readonly plugins?: readonly PluginEntry[]
  /** Options of the built-in plugins, by plugin name. */
  readonly pluginsConfig?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/** A project after its file and the defaults are merged. */
export interface WorkspaceProject {
  /** The project's name. */
  readonly name: string
  /** The project's root, workspace-relative and POSIX. */
  readonly root: string
  /** Where its sources live, workspace-relative and POSIX. */
  readonly sourceRoot: string
  /** The kind of project. */
  readonly projectType: ProjectType
  /** The tags the module boundaries read. */
  readonly tags: readonly string[]
  /** Projects depended on without an import. */
  readonly implicitDependencies: readonly string[]
  /** The targets after the defaults merge, by name. */
  readonly targets: Readonly<Record<string, TargetDefinition>>
}

/** One target of one project: what the pipeline selects and Nx runs. */
export interface TaskRef {
  /** The project's name. */
  readonly project: string
  /** The target's name. */
  readonly target: string
}
