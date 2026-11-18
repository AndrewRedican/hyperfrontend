/**
 * The documentation site's navigation lists a package's pages as the tree their routes form: an
 * entry names one path segment, links to its parent's path followed by that segment, and a
 * segment the site has a page for is linked rather than left as a bare group.
 *
 * @module rules/workspace/docs-site-navigation-tree
 */

import type { Node } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { basename, dirname, join, posix, sep } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'

/** The directory of the site's navigation module, workspace-relative. */
const NAVIGATION_DIRECTORY = 'apps/docs-site/src/lib'

/** The directory the site's routes are read from, workspace-relative. */
const APP_DIRECTORY = 'apps/docs-site/src/app'

/** What a navigation entry's object literal states. */
interface Entry {
  /** The `slug` value, when it is a string. */
  readonly slug: string | null
  /** The `href` value, when it is a string. */
  readonly href: string | null
  /** The `packageName` value, when it is a string. */
  readonly packageName: string | null
  /** The elements of the `children` array, when it is written out. */
  readonly children: readonly (Node | null)[]
}

/**
 * Reads the string a property's value holds.
 *
 * @param node - The value
 * @returns The string, or null
 */
function stringOf(node: Node): string | null {
  return node.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
}

/**
 * Reads the fields of an entry's object literal.
 *
 * @param object - The object expression
 * @returns The fields the rule checks
 */
function entryOf(object: Node): Entry {
  const strings: Record<string, string | null> = {}
  let children: readonly (Node | null)[] = []
  for (const property of object.properties as readonly Node[]) {
    if (property.kind !== 'Property') continue
    const key = property.key as Node
    const name = key.kind === 'Identifier' ? (key.name as string) : stringOf(key)
    const value = property.value as Node
    if (name === 'children' && value.kind === 'ArrayExpression') children = value.elements as readonly (Node | null)[]
    else if (name !== null) strings[name] = stringOf(value)
  }
  return { slug: strings['slug'] ?? null, href: strings['href'] ?? null, packageName: strings['packageName'] ?? null, children }
}

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-navigation-tree',
  language: 'code',
  fixable: false,
  create(context) {
    const path = context.file.path
    const directory = dirname(path)
    if (basename(path) !== 'navigation.ts' || !directory.split(sep).join(posix.sep).endsWith(`/${NAVIGATION_DIRECTORY}`)) return {}
    const root = workspaceRootOf(directory)
    if (root === null) return {}
    /**
     * Checks the entries listed under one path of a package's subtree, and those below them.
     *
     * @param elements - The elements of a `children` array
     * @param parent - The path the entries sit under
     */
    const check = (elements: readonly (Node | null)[], parent: string): void => {
      for (const element of elements) {
        if (element?.kind !== 'ObjectExpression') continue
        const entry = entryOf(element)
        if (entry.slug === null) continue
        const place = `${parent}/${entry.slug}`
        const report = (message: string): void => context.report({ start: element.start, end: element.end, message })
        if (entry.slug.includes('/')) {
          const [first, ...rest] = entry.slug.split('/')
          report(
            `Navigation entry '${entry.slug}' spans more than one path segment. An entry names one segment: list '${rest.join('/')}' in the children of an entry for '${first}'.`
          )
        } else if (entry.href !== null && entry.href !== place) {
          report(
            `Navigation entry '${entry.slug}' links to '${entry.href}', but its place in the tree is '${place}'. List it in the children of the entry for its parent path.`
          )
        } else if (entry.href === null && existsSync(join(root, APP_DIRECTORY, place, 'page.tsx'))) {
          report(`Navigation entry '${entry.slug}' groups the pages under '${place}', which is a page itself. Give it href: '${place}'.`)
        }
        check(entry.children, place)
      }
    }
    return {
      ObjectExpression(node) {
        const entry = entryOf(node)
        if (entry.packageName !== null && entry.href !== null) check(entry.children, entry.href)
      },
    }
  },
})
