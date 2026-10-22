/**
 * What the documentation-site rules read off the site's content module: the entries of its
 * exported `LIBRARIES` array, and the paths and links each entry's pages sit at.
 *
 * @module rules/workspace/shared/docs-site
 */

import type { Node } from '../../../code/model.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, posix, sep } from 'node:path'
import { workspaceRootOf } from './locate.ts'

/** One entry of the `LIBRARIES` array. */
export interface LibraryEntry {
  /** The display name. */
  readonly name: string
  /** The route slug. */
  readonly slug: string
  /** The category, which decides whether the pages sit under plugins or libraries. */
  readonly category: string
  /** The package name, when the entry gives one. */
  readonly packageName: string | null
  /** The README's workspace-relative path, when the entry gives one. */
  readonly readmePath: string | null
  /** The entry's object, which problems are reported on. */
  readonly node: Node
}

/** What a listener for the content module is handed. */
export interface SiteListing {
  /** The workspace root. */
  readonly root: string
  /** The entries that give a name, a slug and a category. */
  readonly entries: readonly LibraryEntry[]
}

/** The site's content module, workspace-relative. */
const CONTENT_DIRECTORY = 'apps/docs-site/src/lib'

/**
 * The string a property's value holds.
 *
 * @param node - The value
 * @returns The string, or null
 */
function stringOf(node: Node): string | null {
  return node.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
}

/**
 * The entries of a `LIBRARIES` array that give a name, a slug and a category.
 *
 * @param array - The array expression
 * @returns The entries, in order
 */
function entriesOf(array: Node): LibraryEntry[] {
  const entries: LibraryEntry[] = []
  for (const element of array.elements as readonly (Node | null)[]) {
    if (element?.kind !== 'ObjectExpression') continue
    const fields: Record<string, string | null> = {}
    for (const property of element.properties as readonly Node[]) {
      if (property.kind !== 'Property') continue
      const key = property.key as Node
      const name = key.kind === 'Identifier' ? key.name : stringOf(key)
      if (typeof name === 'string') fields[name] = stringOf(property.value as Node)
    }
    const { name, slug, category } = fields
    if (!name || !slug || !category) continue
    entries.push({
      name,
      slug,
      category,
      packageName: fields['packageName'] ?? null,
      readmePath: fields['readmePath'] ?? null,
      node: element,
    })
  }
  return entries
}

/**
 * The listener reading the exported `LIBRARIES` array of the site's content module, for a rule
 * that checks nothing else.
 *
 * @param context - The rule context
 * @param check - What is done with the array's entries
 * @returns The listeners, none for a file other than the content module or one outside a workspace
 */
export function siteListingListeners(
  context: RuleContext<unknown, Node>,
  check: (listing: SiteListing) => void
): Record<string, (node: Node) => void> {
  const path = context.file.path
  const directory = dirname(path)
  if (basename(path) !== 'content.ts' || !directory.split(sep).join(posix.sep).endsWith(`/${CONTENT_DIRECTORY}`)) return {}
  const root = workspaceRootOf(directory)
  if (root === null) return {}
  return {
    VariableDeclaration(node) {
      if (node.variableKind !== 'const' || (node.parent as Node).kind !== 'ExportNamedDeclaration') return
      for (const declarator of node.declarations as readonly Node[]) {
        const init = declarator.init as Node | null
        if ((declarator.id as Node).name === 'LIBRARIES' && init?.kind === 'ArrayExpression') check({ root, entries: entriesOf(init) })
      }
    },
  }
}

/**
 * Where an entry's pages sit, workspace-relative.
 *
 * @param entry - A library as the docs site lists it
 * @returns The directory of its main page
 */
export function pagesDirectory(entry: LibraryEntry): string {
  return posix.join(
    entry.category === 'plugin' ? 'apps/docs-site/src/app/docs/plugins' : 'apps/docs-site/src/app/docs/libraries',
    entry.slug
  )
}

/**
 * The link the navigation gives a page of an entry, as the navigation module writes it.
 *
 * @param entry - A library as the docs site lists it
 * @param subpath - The page below the entry's main page, if any
 * @returns The `href` property text
 */
export function navigationLink(entry: LibraryEntry, subpath = ''): string {
  return `href: '${entry.category === 'plugin' ? '/docs/plugins' : '/docs/libraries'}/${entry.slug}${subpath === '' ? '' : `/${subpath}`}'`
}

/**
 * A workspace file's text.
 *
 * @param root - The workspace root
 * @param path - The workspace-relative path
 * @returns The text, or null when the file does not exist
 */
export function readSiteFile(root: string, path: string): string | null {
  const file = join(root, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}
