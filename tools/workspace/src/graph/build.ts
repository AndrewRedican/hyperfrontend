/**
 * The workspace graph, built once per process for a root: the projects and their files, the
 * imports of every code file, the edges they draw, the npm packages each project uses, the path
 * aliases and the installed versions.
 *
 * @module graph/build
 */

import type { Edge, FileImport, NpmUse, ProjectRecord, Resolution } from './model.ts'
import type { Resolver } from './resolve.ts'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compileGlob } from '@hyperfrontend/linter/helpers'
import { importsOfFiles, isCodeFile } from './imports.ts'
import { installedPackages } from './lockfile.ts'
import { packagesOf, projectOfFile, resolveSpecifier } from './resolve.ts'
import { discoverProjects, listFiles, readJson } from './workspace.ts'

/** A workspace's graph. */
export interface WorkspaceGraph extends Resolver {
  /** The workspace root, absolute. */
  readonly root: string
  /** The edges by source project, then by target project and type. */
  readonly edges: ReadonlyMap<string, readonly Edge[]>
  /** The npm packages each project's files import. */
  readonly npmUses: ReadonlyMap<string, readonly NpmUse[]>
  /** The installed version of each top-level package. */
  readonly versions: ReadonlyMap<string, string>
  /** Each `name@version` installed below another package. */
  readonly nested: ReadonlySet<string>
  /** The imports of each code file. */
  readonly imports: ReadonlyMap<string, readonly FileImport[]>
  /** The project owning a file. */
  readonly projectOf: (file: string) => ProjectRecord | null
  /** What a specifier names, seen from a file. */
  readonly resolve: (from: string, specifier: string) => Resolution
}

/** The object form of a root manifest's workspaces. */
interface WorkspaceGlobs {
  /** The globs. */
  readonly packages?: readonly string[]
}

/** The root manifest, as far as the workspaces are read. */
interface RootManifest {
  /** The package-manager workspaces: globs, or an object holding them. */
  readonly workspaces?: readonly string[] | WorkspaceGlobs
}

/** The compiler options of the base tsconfig, as far as the aliases are read. */
interface AliasOptions {
  /** The path aliases, each to its targets. */
  readonly paths?: Readonly<Record<string, readonly string[]>>
}

/** The base tsconfig, as far as the aliases are read. */
interface BaseTsconfig {
  /** The compiler options. */
  readonly compilerOptions?: AliasOptions
}

/** The graphs built so far, by root. */
const graphs = createMap<string, WorkspaceGraph>()

/**
 * The graph of a workspace, built on first request.
 *
 * @param root - The workspace root, absolute
 * @returns The graph, the same object on every later request
 */
export function workspaceGraph(root: string): WorkspaceGraph {
  let graph = graphs.get(root)
  if (graph === undefined) {
    graph = buildGraph(root)
    graphs.set(root, graph)
  }
  return graph
}

/**
 * Builds the graph of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns The graph of projects, edges, npm uses, aliases and versions
 */
export function buildGraph(root: string): WorkspaceGraph {
  const fileList = listFiles(root)
  const files = createSet(fileList)
  const projects = discoverProjects(root, fileList)
  const aliases = createMap<string, readonly string[]>(
    entries(readJson<BaseTsconfig>(join(root, 'tsconfig.base.json'))?.compilerOptions?.paths ?? {})
  )
  const declared = readJson<RootManifest>(join(root, 'package.json'))?.workspaces ?? []
  const globs = isArray(declared) ? (declared as readonly string[]) : ((declared as WorkspaceGlobs).packages ?? [])
  const workspaces = globs.map(compileGlob)
  const resolver: Resolver = { root, files, projects, aliases, packages: packagesOf(workspaces, projects) }
  const imports = importsOfFiles(root, fileList)
  const installed = installedPackages(root)
  const edges = createMap<string, Edge[]>()
  const npmUses = createMap<string, NpmUse[]>()
  for (const project of projects.values()) {
    const own: Edge[] = []
    const uses = createMap<string, string[]>()
    for (const dependency of project.implicitDependencies)
      own.push({ source: project.name, target: dependency, type: 'implicit', files: [] })
    for (const file of project.files) {
      if (!isCodeFile(file)) continue
      // why: the file list can name a tracked file the working tree has deleted, which has no imports to read.
      for (const { specifier, dynamic } of imports.get(file) ?? []) {
        const resolution = resolveSpecifier(resolver, file, specifier)
        if (resolution.kind === 'npm') {
          const list = uses.get(resolution.name) ?? []
          if (!list.includes(file)) list.push(file)
          uses.set(resolution.name, list)
          continue
        }
        // why: Nx keeps an edge into the workspace's own root project only when the root project draws it.
        if (resolution.kind !== 'project' || resolution.project === project || (resolution.project.root === '.' && project.root !== '.'))
          continue
        const type = dynamic ? 'dynamic' : 'static'
        const existing = own.find((edge) => edge.target === resolution.project.name && edge.type === type)
        if (existing === undefined) own.push({ source: project.name, target: resolution.project.name, type, files: [file] })
        else if (!existing.files.includes(file)) (existing.files as string[]).push(file)
      }
    }
    edges.set(project.name, own)
    npmUses.set(
      project.name,
      [...uses].map(([name, list]) => ({ name, files: list }))
    )
  }
  return {
    ...resolver,
    edges,
    npmUses,
    versions: installed.hoisted,
    nested: installed.nested,
    imports,
    projectOf: (file) => projectOfFile(projects, file),
    resolve: (from, specifier) => resolveSpecifier(resolver, from, specifier),
  }
}
