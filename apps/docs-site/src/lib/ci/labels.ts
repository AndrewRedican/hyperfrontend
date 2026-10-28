import type { ExplorerProject } from './model'

/** What a box's icon shows. */
export type IconKind = 'library' | 'utility' | 'demo' | 'tool' | 'test' | 'app' | 'root' | 'package' | 'executor' | 'config'

/** How a node is presented: a short label and the icon that says what kind of thing it is. */
export interface Presentation {
  /** The name without the prefixes and suffixes the icon makes redundant */
  label: string
  /** The icon */
  icon: IconKind
}

/**
 * A name with a prefix removed when it carries it.
 *
 * @param name - A project name
 * @param prefix - What to remove from its start
 * @returns The name without the prefix
 */
function without(name: string, prefix: string): string {
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

/**
 * A library name without `lib-` and `-utils`.
 *
 * @param name - The name after any other prefix is gone
 * @returns The bare name
 */
function bare(name: string): string {
  const unprefixed = without(name, 'lib-')
  return unprefixed.endsWith('-utils') ? unprefixed.slice(0, -'-utils'.length) : unprefixed
}

/**
 * How a project is presented, from its name and, when known, its type and root: `lib-`, `demo-`,
 * `tool-`, `e2e-` and `-utils` are dropped because the icon says the same.
 *
 * @param name - The project's name in the workspace
 * @param type - The project type, when known
 * @param root - The project root, when known
 * @returns The label and the icon
 */
export function presentProject(name: string, type?: ExplorerProject['type'], root?: string): Presentation {
  if (root === '.' || name.startsWith('@')) return { label: 'root', icon: 'root' }
  if (name.startsWith('e2e-')) return { label: bare(without(name, 'e2e-')), icon: 'test' }
  if (name.startsWith('demo-')) return { label: without(name, 'demo-'), icon: 'demo' }
  if (name.startsWith('tool-')) return { label: without(name, 'tool-'), icon: 'tool' }
  if (name.startsWith('plugin-')) return { label: without(name, 'plugin-'), icon: 'tool' }
  if (name.startsWith('lib-')) return { label: bare(name), icon: name.endsWith('-utils') ? 'utility' : 'library' }
  return { label: name, icon: type === 'lib' ? 'library' : type === 'e2e' ? 'test' : 'app' }
}

/**
 * How a node of the graph is presented.
 *
 * @param id - `project:<name>`, `external:<name>@<version>`, `tool:<id>` or `config:<path>`
 * @param project - The project, for a project node
 * @returns The label and the icon
 */
export function presentNode(id: string, project?: ExplorerProject): Presentation {
  const colon = id.indexOf(':')
  const kind = id.slice(0, colon)
  const rest = id.slice(colon + 1)
  if (kind === 'project') return presentProject(rest, project?.type, project?.root)
  if (kind === 'external') {
    const at = rest.lastIndexOf('@')
    return { label: at > 0 ? rest.slice(0, at) : rest, icon: 'package' }
  }
  if (kind === 'tool') return { label: rest, icon: 'executor' }
  return { label: rest, icon: 'config' }
}

/** What each icon is called, for a screen reader and a tooltip. */
export const ICON_NAMES: Record<IconKind, string> = {
  library: 'library',
  utility: 'utility library',
  demo: 'demo',
  tool: 'workspace tool',
  test: 'end-to-end tests',
  app: 'application',
  root: 'workspace root',
  package: 'npm package',
  executor: 'executor',
  config: 'configuration file',
}
