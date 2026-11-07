/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * What an executor is handed: the workspace root and the working directory, the project and the
 * target it runs, every project's configuration with its targets resolved, and `hf.json` as
 * written.
 *
 * @module runner/context
 */

import type { ProjectRecord } from '../graph/model'
import type { ExecutorContext, ProjectConfiguration, WorkspaceConfiguration } from './contract'
import type { ResolvedTarget } from './targets'
import { projectTargets } from './targets'

/** A project's configuration as the runner resolves it. */
export interface ResolvedProject extends ProjectConfiguration {
  /** The targets, merged with their defaults and their tokens replaced. */
  targets: Record<string, ResolvedTarget>
}

/** What an executor context is built from. */
export interface ContextRequest {
  /** The workspace root, absolute. */
  readonly root: string
  /** The directory the command line started in. */
  readonly cwd: string
  /** The project the task runs on. */
  readonly projectName: string
  /** The target the task runs. */
  readonly targetName: string
  /** The target, resolved. */
  readonly target: ResolvedTarget
  /** The workspace configuration, as `hf.json` writes it. */
  readonly configuration: WorkspaceConfiguration
  /** Every project's configuration by name. */
  readonly configurations: Readonly<Record<string, ResolvedProject>>
}

/**
 * A project's configuration: its `project.json` as written, with its name, root, type, tags and
 * implicit dependencies as discovery reads them and its targets resolved.
 *
 * @param configuration - The workspace configuration
 * @param project - The project, as discovery records it
 * @returns Its configuration as executors read it
 */
export function projectConfiguration(configuration: WorkspaceConfiguration, project: ProjectRecord): ResolvedProject {
  const written = project.configuration ?? {}
  return {
    ...(written as Readonly<Record<string, unknown>>),
    name: project.name,
    root: project.root,
    projectType: written.projectType as ProjectConfiguration['projectType'],
    tags: [...project.tags],
    implicitDependencies: [...project.implicitDependencies],
    targets: projectTargets(configuration, project),
  }
}

/**
 * Every project's configuration.
 *
 * @param configuration - The workspace configuration
 * @param projects - The workspace's projects by name
 * @returns The configurations by project name
 */
export function projectConfigurations(
  configuration: WorkspaceConfiguration,
  projects: ReadonlyMap<string, ProjectRecord>
): Record<string, ResolvedProject> {
  const configurations: Record<string, ResolvedProject> = {}
  for (const project of projects.values()) configurations[project.name] = projectConfiguration(configuration, project)
  return configurations
}

/**
 * The context an executor is called with.
 *
 * @param request - The task and the workspace it runs in
 * @returns The context as executors read it
 */
export function executorContext(request: ContextRequest): ExecutorContext {
  return {
    root: request.root,
    cwd: request.cwd,
    projectName: request.projectName,
    targetName: request.targetName,
    target: request.target,
    projects: { ...request.configurations },
    configuration: request.configuration,
  }
}
