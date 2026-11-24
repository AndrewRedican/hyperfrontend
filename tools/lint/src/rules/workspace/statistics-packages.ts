/**
 * The statistics service tracks every publishable library: the `packages` array in the immutable
 * section of its configuration names each one by package, once, and names nothing else. A
 * missing package is inserted.
 *
 * @module rules/workspace/statistics-packages
 */

import type { Fix, Node } from '@hyperfrontend/linter'
import { dirname, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { mergeEdits } from '@hyperfrontend/linter/helpers'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'
import { namedLibraries } from './shared/libraries.ts'

/** What reading the configuration for its list found. */
interface Reading {
  /** Whether `node` is the list, every entry of it a string literal. */
  readonly readable: boolean
  /** The list, or the node closest to what keeps it from being read. */
  readonly node: Node
}

/** The service's configuration, workspace-relative. */
const CONFIG = 'apps/statistics/service.config.ts'

/** The members leading from the default export to the list. */
const MEMBERS = ['immutable', 'packages']

/** What the rule reports for a configuration whose list it cannot read. */
const UNREADABLE =
  'The default export must be an object literal whose immutable.packages is an array of string literals, one per tracked package'

/**
 * The expression a type assertion or a `satisfies` check wraps.
 *
 * @param node - An expression
 * @returns The expression itself once every `as` and `satisfies` around it is removed
 */
function unwrapped(node: Node): Node {
  let inner = node
  while (inner.kind === 'TSAsExpression' || inner.kind === 'TSSatisfiesExpression') inner = inner.expression as Node
  return inner
}

/**
 * The value an object literal gives a member, as the running program reads it: the last one
 * where a key is written twice.
 *
 * @param object - The object literal
 * @param name - The key the member is written under
 * @returns The value, or null when no plain key names the member
 */
function member(object: Node, name: string): Node | null {
  let value: Node | null = null
  for (const property of object.properties as readonly Node[]) {
    if (property.kind !== 'Property' || property.computed === true) continue
    const key = property.key as Node
    if ((key.kind === 'Identifier' ? key.name : key.value) === name) value = unwrapped(property.value as Node)
  }
  return value
}

/**
 * Reads the list of tracked packages out of what the configuration exports by default.
 *
 * @param exported - The default export's expression
 * @returns The list when every entry is a string literal, otherwise the node closest to the problem
 */
function read(exported: Node): Reading {
  let node = unwrapped(exported)
  for (const name of MEMBERS) {
    const value = node.kind === 'ObjectExpression' ? member(node, name) : null
    if (value === null) return { readable: false, node }
    node = value
  }
  if (node.kind !== 'ArrayExpression') return { readable: false, node }
  const other = (node.elements as readonly (Node | null)[]).find(
    (element) => element?.kind !== 'Literal' || typeof element.value !== 'string'
  )
  // why: a hole is no node, so the array answers for it.
  return other === undefined ? { readable: true, node } : { readable: false, node: other ?? node }
}

/**
 * The fix inserting package names into the list: each one before the first entry that sorts
 * after it when the list is in ascending order, otherwise after the last entry.
 *
 * @param text - The file's text
 * @param list - The array of string literals
 * @param names - The names to insert, in ascending order
 * @returns The fix, or null when the brackets hold anything besides entries, commas and whitespace
 */
function insertion(text: string, list: Node, names: readonly string[]): Fix | null {
  const elements = list.elements as readonly Node[]
  const first = elements[0]
  if (first === undefined) {
    if (text.slice(list.start + 1, list.end - 1).trim() !== '') return null
    return { start: list.start + 1, end: list.start + 1, text: names.map((name) => `'${name}'`).join(', ') }
  }
  const last = elements[elements.length - 1] as Node
  const lead = text.slice(list.start + 1, first.start)
  const gaps = elements.slice(1).map((element, index) => text.slice((elements[index] as Node).end, element.start))
  const tail = text.slice(last.end, list.end - 1).trim()
  // why: a comment belongs to the entry beside it, and an insertion cannot tell which side that is.
  if (lead.trim() !== '' || gaps.some((gap) => gap.trim() !== ',') || (tail !== '' && tail !== ',')) return null
  const quote = text[first.start]
  const separator = gaps[0] ?? `,${lead === '' ? ' ' : lead}`
  const sorted = elements.every(
    (element, index) => index === 0 || ((elements[index - 1] as Node).value as string) <= (element.value as string)
  )
  return mergeEdits(
    text,
    names.map((name) => {
      const entry = `${quote}${name}${quote}`
      const next = sorted ? elements.find((element) => (element.value as string) > name) : undefined
      return next === undefined
        ? { start: last.end, end: last.end, text: `${separator}${entry}` }
        : { start: next.start, end: next.start, text: `${entry}${separator}` }
    })
  )
}

export default defineRule<undefined, Node>({
  id: 'workspace/statistics-packages',
  language: 'code',
  fixable: true,
  create(context) {
    const path = context.file.path
    const root = workspaceRootOf(dirname(path))
    if (root === null || relative(root, path).split(sep).join(posix.sep) !== CONFIG) return {}
    return {
      Program(program) {
        const exported = (program.body as readonly Node[]).find((statement) => statement.kind === 'ExportDefaultDeclaration')
        if (exported === undefined)
          return context.report({ start: 0, at: { line: 1, column: 1, endLine: 1, endColumn: 1 }, message: UNREADABLE })
        const { readable, node: list } = read(exported.declaration as Node)
        if (!readable) return context.report({ start: list.start, end: list.end, message: UNREADABLE })
        const libraries = createMap(namedLibraries(root).map((library): [string, string] => [library.packageName, library.path]))
        const listed = createSet<string>()
        for (const element of list.elements as readonly Node[]) {
          const name = element.value as string
          if (listed.has(name)) {
            context.report({ start: element.start, end: element.end, message: `'${name}' is listed more than once in immutable.packages` })
          } else if (!libraries.has(name)) {
            context.report({
              start: element.start,
              end: element.end,
              message: `'${name}' is not the package name of a publishable library of this workspace`,
            })
          }
          listed.add(name)
        }
        const missing = [...libraries.keys()].filter((name) => !listed.has(name)).sort()
        if (missing.length === 0) return
        const fix = insertion(context.file.text, list, missing)
        for (const name of missing) {
          context.report({
            start: list.start,
            end: list.end,
            message: `Publishable library '${name}' (${libraries.get(name)}) is not listed in immutable.packages, so the service would never collect its downloads`,
            ...(fix === null ? {} : { fix }),
          })
        }
      },
    }
  },
})
