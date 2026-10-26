/**
 * The packages a project's build uses, as the previous rule counted them: the npm packages and
 * buildable workspace packages its build inputs import, each at the version installed for the
 * importing file.
 *
 * @module rules/projects/shared/dependencies
 */

import type { FileImport, ProjectRecord, WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { compileGlob } from '@hyperfrontend/linter/helpers'

/** An installed package's manifest, as far as its version is read. */
interface InstalledManifest {
  /** The installed version. */
  readonly version?: unknown
}

/**
 * The files of a project its build reads: those its inputs match, less those the ignored patterns name.
 *
 * @param project - The graph node whose files are matched
 * @param inputs - The input patterns
 * @param ignored - The ignored patterns
 * @returns The files, in the project's order
 */
export function inputFiles(project: ProjectRecord, inputs: readonly string[], ignored: readonly string[]): string[] {
  const expanded = [...inputs, ...ignored.map((pattern) => `!${pattern}`)]
    .map((pattern) => pattern.replace('{projectRoot}', project.root))
    .map((pattern) => (pattern.startsWith('./') ? pattern.slice(2) : pattern.startsWith('!./') ? `!${pattern.slice(3)}` : pattern))
  const positive = expanded.filter((pattern) => !pattern.startsWith('!')).map(compileGlob)
  const negative = expanded.filter((pattern) => pattern.startsWith('!')).map((pattern) => compileGlob(pattern.slice(1)))
  // lint-disable-next-line workspace/cross-platform -- an Nx input is a POSIX glob, whatever the platform
  const everything = positive.length === 0 || (positive.length === 1 && positive[0]?.pattern === `${project.root}/**/*`)
  return project.files.filter(
    (file) => (everything || positive.some((glob) => glob.test(file))) && !negative.some((glob) => glob.test(file))
  )
}

/**
 * The version of an npm package the graph knows for a file: the version installed nearest the
 * file when the lock file records it below another package, else the top-level version.
 *
 * @param graph - The workspace graph
 * @param file - The importing file, workspace-relative
 * @param name - The package
 * @returns The version, or null when the lock file installs no such package
 */
export function installedVersion(graph: WorkspaceGraph, file: string, name: string): string | null {
  let directory = posix.dirname(file)
  for (;;) {
    const manifest = join(graph.root, directory, 'node_modules', name, 'package.json')
    if (existsSync(manifest)) {
      const version = (parse(readFileSync(manifest, 'utf8')) as InstalledManifest).version
      if (typeof version === 'string' && graph.nested.has(`${name}@${version}`)) return version
      break
    }
    if (directory === '.') break
    directory = posix.dirname(directory)
  }
  return graph.versions.get(name) ?? null
}

/**
 * The packages a project's build uses and the version each is expected at.
 *
 * @param graph - The workspace graph
 * @param project - The graph node whose own imports are skipped
 * @param files - The files counted
 * @returns The versions by package name, in the order first seen
 */
export function usedPackages(graph: WorkspaceGraph, project: ProjectRecord, files: readonly string[]): Map<string, string> {
  const used = createMap<string, string>()
  const manifest = posix.join(project.root, 'package.json')
  for (const file of files) {
    if (file === manifest) continue
    for (const { specifier } of graph.imports.get(file) ?? ([] as readonly FileImport[])) {
      const resolution = graph.resolve(file, specifier)
      if (resolution.kind === 'npm') {
        const version = installedVersion(graph, file, resolution.name)
        if (version !== null) used.set(resolution.name, version)
        continue
      }
      if (resolution.kind !== 'project') continue
      const target = resolution.project
      if (target === project || (target.root === '.' && project.root !== '.')) continue
      const name = target.manifest?.name
      if (target.configuration?.targets?.['build'] !== undefined && name !== undefined) used.set(name, target.manifest?.version ?? '*')
    }
  }
  return used
}
