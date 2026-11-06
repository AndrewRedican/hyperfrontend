/**
 * The entry points a project exposes: each `package.json#exports` subpath and each path alias of
 * `tsconfig.base.json` naming the package, resolved to the source file it stands for. Where both
 * name an entry the alias wins, since the workspace compiles against the alias.
 *
 * @module graph/entries
 */

import type { EntryNode, ProjectRecord } from './model'
import { posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { fileOf } from './resolve'

/** The conditions of an export written as an object, in the order a source file is looked for. */
const CONDITIONS = ['import', 'require', 'default', 'types']

/**
 * The file an export value names: a string, or the first string found among the conditions of
 * an object, conditions nested in conditions included.
 *
 * @param value - The value of one `exports` key
 * @returns The path as the manifest writes it, or null when the value names no file
 */
export function exportTarget(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return null
  const record = value as Readonly<Record<string, unknown>>
  for (const condition of CONDITIONS) {
    const target = exportTarget(record[condition])
    if (target !== null) return target
  }
  return null
}

/**
 * An `exports` field as a map of subpaths: a string or a conditions object stands for the main
 * entry alone.
 *
 * @param exportsField - The field as the manifest writes it
 * @returns The subpaths to their values, empty when the field is absent
 */
function subpathsOf(exportsField: unknown): Readonly<Record<string, unknown>> {
  if (typeof exportsField === 'string') return { '.': exportsField }
  if (exportsField === null || typeof exportsField !== 'object') return {}
  const record = exportsField as Readonly<Record<string, unknown>>
  return keys(record).some((key) => key.startsWith('.')) ? record : { '.': record }
}

/**
 * The entries of a project: its export subpaths, then the aliases naming its package, each to
 * the source file it resolves to. A subpath or alias naming no file in the project is left out.
 *
 * @param project - The project whose entries are read
 * @param aliases - The workspace's path aliases, each to its targets
 * @param files - The workspace's files
 * @returns The entries, in the order found
 */
export function entriesOfProject(
  project: ProjectRecord,
  aliases: ReadonlyMap<string, readonly string[]>,
  files: ReadonlySet<string>
): EntryNode[] {
  const name = project.manifest?.name
  if (name === undefined) return []
  const found = createMap<string, EntryNode>()
  for (const [subpath, value] of entries(subpathsOf(project.manifest?.exports))) {
    if (subpath === './package.json' || subpath.includes('*') || !(subpath === '.' || subpath.startsWith('./'))) continue
    const target = exportTarget(value)
    const file = target === null ? null : fileOf(files, posix.normalize(posix.join(project.root, target)))
    const id = subpath === '.' ? name : `${name}/${subpath.slice(2)}`
    if (file !== null) found.set(id, { kind: 'entry', id, project: project.name, file })
  }
  for (const [alias, targets] of aliases) {
    if ((alias !== name && !alias.startsWith(`${name}/`)) || alias.includes('*')) continue
    const file = targets.map((target) => fileOf(files, target)).find((candidate) => candidate !== null) ?? null
    if (file !== null && (project.root === '.' || file.startsWith(`${project.root}${posix.sep}`)))
      found.set(alias, { kind: 'entry', id: alias, project: project.name, file })
  }
  return [...found.values()]
}
