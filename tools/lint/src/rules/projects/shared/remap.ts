/**
 * The rewrites the boundary rule offers: an import of another project by path becomes imports of
 * the aliases whose entries export each name, and an import of a project's own alias becomes
 * relative imports of the files declaring each name.
 *
 * @module rules/projects/shared/remap
 */

import type { Node } from '@hyperfrontend/linter'
import type { ProjectRecord, WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { existsSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { relativePath } from '@hyperfrontend/project-scope/core/path'
import { fileOf, substituteWildcard } from '@hyperfrontend/workspace/graph'
import { moduleExports } from '../../workspace/shared/exports-index.ts'

/** One name to import from one module. */
interface Remapped {
  /** The names, joined as an import list. */
  member: string
  /** The module specifier. */
  readonly path: string
}

/** One alias entry of a project. */
interface Entry {
  /** The alias's target path, workspace-relative as tsconfig writes it. */
  readonly path: string
  /** The alias. */
  readonly scope: string
}

/**
 * The names a declaration imports by name, those written as strings left unknown.
 *
 * @param node - The declaration, expression or call naming the module
 * @returns The names, or null when it imports nothing by name
 */
export function namedImports(node: Node): (string | null)[] | null {
  const specifiers = node.specifiers as readonly Node[] | undefined
  if (specifiers === undefined || specifiers.length === 0) return null
  return specifiers
    .filter((specifier) => specifier.kind === 'ImportSpecifier')
    .map((specifier) => ((specifier.imported as Node).kind === 'Identifier' ? ((specifier.imported as Node).name as string) : null))
}

/**
 * The file declaring a name a module exports, following re-exports.
 *
 * @param graph - The workspace graph
 * @param path - The module's path, workspace-relative, its extension or index file possibly left out
 * @param name - The imported binding, or null for a namespace or side-effect import
 * @returns The declaring file, absolute, or null when the module does not export the name
 */
function declaringFile(graph: WorkspaceGraph, path: string, name: string | null): string | null {
  const file = fileOf(graph.files, posix.normalize(path))
  if (file === null || name === null) return null
  return moduleExports(join(graph.root, file)).find((exported) => exported.name === name)?.file ?? null
}

/**
 * The import statements for a list of remapped names, one per module, as the previous fixer wrote them.
 *
 * @param remapped - The names and their modules, in order
 * @returns The statements, newline-separated, or the empty text when there is nothing to import
 */
function importStatements(remapped: readonly Remapped[]): string {
  const grouped: Remapped[] = []
  for (const item of remapped) {
    const existing = grouped.find((group) => group.path === item.path && group.member !== item.member)
    if (existing === undefined) grouped.push({ member: item.member, path: item.path })
    else existing.member += `, ${item.member}`
  }
  return grouped.map((group) => `import { ${group.member} } from '${group.path}';`).join('\n')
}

/**
 * The alias entries pointing inside a project's source directory.
 *
 * @param graph - The workspace graph
 * @param project - The graph node whose manifest exports are read
 * @returns The entries, in alias order
 */
function entriesOf(graph: WorkspaceGraph, project: ProjectRecord): Entry[] {
  const configured = project.configuration?.sourceRoot
  const sourceRoot = configured ?? (existsSync(join(graph.root, project.root, 'src')) ? posix.join(project.root, 'src') : project.root)
  const entries: Entry[] = []
  for (const [scope, targets] of graph.aliases) {
    const inside = targets.some((target) => {
      const mapped = target.replace(/^\.\//, '')
      return mapped === sourceRoot || mapped.startsWith(`${sourceRoot}${posix.sep}`)
    })
    if (inside) for (const path of targets) entries.push({ path, scope })
  }
  return entries
}

/**
 * The text replacing an import of another project by path: one import of an alias per name that
 * alias's entry exports.
 *
 * @param graph - The workspace graph
 * @param file - The importing file, workspace-relative
 * @param target - The imported project
 * @param specifier - The specifier as written
 * @param node - The declaration naming the module
 * @returns The replacement, or null when no name can be remapped
 */
export function aliasImports(graph: WorkspaceGraph, file: string, target: ProjectRecord, specifier: string, node: Node): string | null {
  const names = namedImports(node)
  if (names === null) return null
  const remapped: Remapped[] = []
  for (const entry of entriesOf(graph, target)) {
    let { path, scope } = entry
    if (path.includes('*')) {
      const imported = posix.normalize(posix.join(posix.dirname(file), specifier))
      const base = path.slice(0, path.indexOf('*'))
      if (imported.startsWith(base)) {
        const rest = imported.slice(base.length)
        path = substituteWildcard(path, rest)
        scope = substituteWildcard(scope, rest)
      }
    }
    for (const name of names) if (declaringFile(graph, path, name) !== null) remapped.push({ member: String(name), path: scope })
  }
  const text = importStatements(remapped)
  return text === '' ? null : text
}

/**
 * The text replacing an import of a project's own alias: one relative import per name, of the file
 * declaring it.
 *
 * @param graph - The workspace graph
 * @param file - The importing file, workspace-relative
 * @param specifier - The alias as written
 * @param node - The declaration naming the module
 * @returns The replacement, or null when no name can be remapped
 */
export function relativeImports(graph: WorkspaceGraph, file: string, specifier: string, node: Node): string | null {
  const names = namedImports(node)
  if (names === null) return null
  const remapped: Remapped[] = []
  for (const path of entryPaths(graph, specifier)) {
    for (const name of names) {
      const declaring = declaringFile(graph, path, name)
      if (declaring === null) continue
      const directory = relativePath(dirname(join(graph.root, file)), dirname(declaring))
      const base = basename(declaring)
      const joined = directory === '' ? `./${base}` : posix.join(directory, base)
      const relative = joined.startsWith('./') || joined.startsWith('../') ? joined : `./${joined}`
      remapped.push({ member: String(name), path: relative.replace(/.tsx?$/, '') })
    }
  }
  const text = importStatements(remapped)
  return text === '' ? null : text
}

/**
 * The target paths of an alias, exact or through the first wildcard alias it starts with.
 *
 * @param graph - The workspace graph
 * @param specifier - The alias as written
 * @returns The paths, none when no alias matches
 */
function entryPaths(graph: WorkspaceGraph, specifier: string): readonly string[] {
  const exact = graph.aliases.get(specifier)
  if (exact !== undefined) return exact
  for (const [alias, targets] of graph.aliases) {
    if (!alias.endsWith('*')) continue
    const prefix = alias.slice(0, -1)
    if (specifier.startsWith(prefix)) return targets.map((target) => substituteWildcard(target, specifier.slice(prefix.length)))
  }
  return []
}
