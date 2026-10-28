/**
 * The edges a project's configuration draws without an import: the projects it declares as
 * implicit dependencies, the packages its manifest depends on, the tools its targets run, and the
 * configuration files and other projects' files its targets read as inputs.
 *
 * @module graph/declared-edges
 */

import type { Edge, EdgeKind, GraphNode, PackageManifest, ProjectRecord, ToolNode } from './model'
import { join, posix } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { selfInputs, targetExecutor, targetInputs } from './inputs'
import { nodeId } from './model'
import { fileOf, packageNameOf, projectOfFile } from './resolve'
import { Role } from './roles'
import { readJson } from './workspace'

/** The manifest sections whose packages a project depends on. */
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

/** The characters that make a pattern a glob. */
const GLOB_CHARS = /[*?[{]/

/** The prefix of an input naming a file outside the project. */
const WORKSPACE_ROOT = '{workspaceRoot}/'

/** One executor of an executors manifest, as far as it is read. */
interface ExecutorEntry {
  /** The implementation module, relative to the package. */
  readonly implementation?: string
}

/** An executors manifest, as far as the implementations are read. */
interface ExecutorsManifest {
  /** The executors by name. */
  readonly executors?: Readonly<Record<string, ExecutorEntry>>
}

/** What the declared edges of a workspace are drawn against. */
export interface DeclaredEdgeContext {
  /** The workspace root, absolute. */
  readonly root: string
  /** The projects by name. */
  readonly projects: ReadonlyMap<string, ProjectRecord>
  /** The projects by the name of the package they carry. */
  readonly byPackage: ReadonlyMap<string, ProjectRecord>
  /** The installed version of each top-level package. */
  readonly versions: ReadonlyMap<string, string>
  /** The workspace's files. */
  readonly files: ReadonlySet<string>
  /** The tools found so far, by id; a tool found here is added. */
  readonly tools: Map<string, ToolNode>
}

/** What one project's declarations produce. */
export interface DeclaredEdges {
  /** The edges, in configuration order. */
  readonly edges: readonly Edge[]
  /** The tool and configuration nodes the edges introduce. */
  readonly nodes: readonly GraphNode[]
}

/**
 * A file of a project, workspace-relative.
 *
 * @param project - The project the file belongs to
 * @param name - The file's name under the project root
 * @returns The path, without a leading `./` for the workspace itself
 */
function projectFile(project: ProjectRecord, name: string): string {
  return project.root === '.' ? name : posix.join(project.root, name)
}

/**
 * The edges a project's configuration and manifest declare.
 *
 * @param context - The projects, packages, versions and files
 * @param project - The project whose declarations are read
 * @returns The edges and the nodes they introduce
 */
export function declaredEdges(context: DeclaredEdgeContext, project: ProjectRecord): DeclaredEdges {
  const edges: Edge[] = []
  const nodes: GraphNode[] = []
  const source = nodeId({ kind: 'project', name: project.name, root: project.root })
  const configured = (
    target: string,
    kind: EdgeKind,
    file: string,
    key: string,
    path: Edge['path'] = null,
    targets: readonly string[] = []
  ): void => {
    edges.push({ source, target, kind, role: Role.BuildConfig, path, targets, evidence: { kind: 'configuration', file, key } })
  }
  const configuration = projectFile(project, 'project.json')
  for (const dependency of project.implicitDependencies)
    configured(`project:${dependency}`, 'declared', configuration, 'implicitDependencies')
  if (project.manifest !== null) manifestEdges(context, project, configured)
  for (const target of keys(project.configuration?.targets ?? {})) {
    toolEdges(context, project, target, configured, edges, nodes)
    inputEdges(context, project, target, configured, nodes)
  }
  return { edges, nodes }
}

/** Adds one configured edge from the project. */
type Configure = (target: string, kind: EdgeKind, file: string, key: string, path?: Edge['path'], targets?: readonly string[]) => void

/**
 * The edges a manifest's dependency sections declare: to the workspace project carrying a
 * package, else to the installed package.
 *
 * @param context - The packages and versions
 * @param project - The project whose manifest is read
 * @param configured - Adds an edge
 */
function manifestEdges(context: DeclaredEdgeContext, project: ProjectRecord, configured: Configure): void {
  const manifest = project.manifest as PackageManifest
  const file = projectFile(project, 'package.json')
  for (const section of DEPENDENCY_SECTIONS) {
    for (const name of keys(manifest[section] ?? {})) {
      const owner = context.byPackage.get(name)
      const target =
        owner === undefined
          ? nodeId({ kind: 'external', name, version: context.versions.get(name) ?? null })
          : nodeId({ kind: 'project', name: owner.name, root: owner.root })
      configured(target, 'manifest', file, `${section}.${name}`, {
        specifier: name,
        resolved: owner === undefined ? name : projectFile(owner, 'package.json'),
      })
    }
  }
}

/**
 * The edge from a project to the tool a target runs, and from a newly found tool to the project
 * implementing it.
 *
 * @param context - The packages, files and tools
 * @param project - The project whose target is read
 * @param target - The target's name
 * @param configured - Adds an edge from the project
 * @param edges - Where a tool's own edge goes
 * @param nodes - Where a new tool node goes
 */
function toolEdges(
  context: DeclaredEdgeContext,
  project: ProjectRecord,
  target: string,
  configured: Configure,
  edges: Edge[],
  nodes: GraphNode[]
): void {
  const executor = targetExecutor(context.root, project, target)
  if (executor === null) return
  const id = executor.value
  let tool = context.tools.get(id)
  if (tool === undefined) {
    tool = toolOf(context, id)
    context.tools.set(id, tool)
    nodes.push(tool)
    if (tool.project !== null) {
      const owner = context.projects.get(tool.project) as ProjectRecord
      edges.push({
        source: nodeId(tool),
        target: nodeId({ kind: 'project', name: owner.name, root: owner.root }),
        kind: 'tool',
        role: Role.BuildConfig,
        path: { specifier: id, resolved: tool.entry },
        targets: [],
        evidence: {
          kind: 'configuration',
          file: projectFile(owner, 'executors.json'),
          key: `executors.${id.slice(id.indexOf(':') + 1)}.implementation`,
        },
      })
    }
  }
  const [file, key] =
    executor.from === 'project'
      ? [projectFile(project, 'project.json'), `targets.${target}.executor`]
      : ['nx.json', `targetDefaults.${target}.executor`]
  configured(nodeId(tool), 'tool', file, key, { specifier: id, resolved: tool.entry }, [target])
}

/**
 * The tool an executor names: the workspace project carrying its package, and the implementation
 * file that project's executors manifest names.
 *
 * @param context - The packages and files
 * @param id - The executor, `<package>:<name>`
 * @returns The tool node
 */
function toolOf(context: DeclaredEdgeContext, id: string): ToolNode {
  const colon = id.indexOf(':')
  const owner = colon === -1 ? undefined : context.byPackage.get(packageNameOf(id.slice(0, colon)))
  if (owner === undefined) return { kind: 'tool', id, project: null, entry: null }
  const manifest = readJson<ExecutorsManifest>(join(context.root, projectFile(owner, owner.manifest?.executors ?? 'executors.json')))
  const implementation = manifest?.executors?.[id.slice(colon + 1)]?.implementation
  const entry = implementation === undefined ? null : fileOf(context.files, posix.normalize(projectFile(owner, implementation)))
  return { kind: 'tool', id, project: owner.name, entry }
}

/**
 * The edges a target's inputs declare: to the projects whose inputs it names, to the projects
 * whose files a workspace-rooted glob reaches, and to the configuration files it names.
 *
 * @param context - The projects
 * @param project - The project whose target is read
 * @param target - The target's name
 * @param configured - Adds an edge
 * @param nodes - Where a new configuration node goes
 */
function inputEdges(context: DeclaredEdgeContext, project: ProjectRecord, target: string, configured: Configure, nodes: GraphNode[]): void {
  const inputs = targetInputs(context.root, project, target)
  const [file, key] =
    inputs.from === 'project'
      ? [projectFile(project, 'project.json'), `targets.${target}.inputs`]
      : ['nx.json', inputs.from === 'defaults' ? `targetDefaults.${target}.inputs` : 'namedInputs.default']
  for (const input of inputs.value) {
    if (typeof input === 'string' || input.projects === undefined || input.projects === 'self') continue
    for (const name of typeof input.projects === 'string' ? [input.projects] : input.projects)
      configured(`project:${name}`, 'config', file, key, null, [target])
  }
  for (const pattern of selfInputs(context.root, project, target)) {
    if (!pattern.startsWith(WORKSPACE_ROOT)) continue
    const path = pattern.slice(WORKSPACE_ROOT.length)
    const glob = GLOB_CHARS.exec(path)
    const prefix =
      glob === null ? path : path.slice(0, path.lastIndexOf(posix.sep, glob.index) === -1 ? 0 : path.lastIndexOf(posix.sep, glob.index))
    const owner = glob === null ? null : projectOfFile(context.projects, prefix)
    if (owner !== null && owner !== project && owner.root !== '.') {
      configured(
        nodeId({ kind: 'project', name: owner.name, root: owner.root }),
        'config',
        file,
        key,
        { specifier: pattern, resolved: owner.root },
        [target]
      )
      continue
    }
    nodes.push({ kind: 'config', path })
    configured(`config:${path}`, 'config', file, key, { specifier: pattern, resolved: glob === null ? path : null }, [target])
  }
}
