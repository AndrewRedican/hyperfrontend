/**
 * What an executor is handed: the workspace root and the working directory, the project and the
 * target it runs, every project's configuration with its targets resolved, `nx.json` as written,
 * and the project graph as discovery knows it, whose edges are the implicit dependencies the
 * projects declare.
 *
 * @module runner/context
 */

import type {
  ExecutorContext,
  NxJsonConfiguration,
  ProjectConfiguration,
  ProjectGraph,
  ProjectType,
} from '@hyperfrontend/integration-nx/compat'
import type { ProjectRecord } from '../graph/model'
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
  /** The workspace configuration, as `nx.json` writes it. */
  readonly nx: NxJsonConfiguration
  /** The workspace's projects by name. */
  readonly projects: ReadonlyMap<string, ProjectRecord>
  /** Every project's configuration by name. */
  readonly configurations: Readonly<Record<string, ResolvedProject>>
}

/**
 * A project's configuration: its `project.json` as written, with its name, root, type, tags and
 * implicit dependencies as discovery reads them and its targets resolved.
 *
 * @param nx - The workspace configuration
 * @param project - The project, as discovery records it
 * @returns Its configuration as executors read it
 */
export function projectConfiguration(nx: NxJsonConfiguration, project: ProjectRecord): ResolvedProject {
  const written = project.configuration ?? {}
  return {
    ...(written as Readonly<Record<string, unknown>>),
    name: project.name,
    root: project.root,
    projectType: (written.projectType ?? project.manifest?.nx?.['projectType']) as ProjectType | undefined,
    tags: [...project.tags],
    implicitDependencies: [...project.implicitDependencies],
    targets: projectTargets(nx, project),
  }
}

/**
 * Every project's configuration.
 *
 * @param nx - The workspace configuration
 * @param projects - The workspace's projects by name
 * @returns The configurations by project name
 */
export function projectConfigurations(
  nx: NxJsonConfiguration,
  projects: ReadonlyMap<string, ProjectRecord>
): Record<string, ResolvedProject> {
  const configurations: Record<string, ResolvedProject> = {}
  for (const project of projects.values()) configurations[project.name] = projectConfiguration(nx, project)
  return configurations
}

/**
 * The project graph an executor reads: a node per project whose data is its configuration, and
 * an implicit edge per implicit dependency; edges drawn from imports are left out, since finding
 * them means parsing every source file.
 *
 * @param projects - The workspace's projects by name
 * @param configurations - Every project's configuration by name
 * @returns The nodes and the edges, by project name
 */
export function projectGraph(
  projects: ReadonlyMap<string, ProjectRecord>,
  configurations: Readonly<Record<string, ResolvedProject>>
): ProjectGraph {
  const nodes: ProjectGraph['nodes'] = {}
  const dependencies: ProjectGraph['dependencies'] = {}
  for (const project of projects.values()) {
    nodes[project.name] = { name: project.name, type: project.type, data: configurations[project.name] as ResolvedProject }
    dependencies[project.name] = project.implicitDependencies.map((target) => ({ source: project.name, target, type: 'implicit' }))
  }
  return { nodes, dependencies }
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
    projectsConfigurations: { version: 2, projects: { ...request.configurations } },
    nxJsonConfiguration: request.nx,
    projectGraph: projectGraph(request.projects, request.configurations),
    isVerbose: false,
  }
}
