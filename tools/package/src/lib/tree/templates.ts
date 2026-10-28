/**
 * Writes a directory of templates into a tree: each file lands under the target with its
 * `.template` suffix dropped, and every `<%= expression %>` in it replaced by the value the
 * substitutions hold for it.
 *
 * @module lib/tree/templates
 */

import type { Tree } from './tree'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'
import { joinPathFragments } from './paths'

/** The values a template may name. */
export type Substitutions = Readonly<Record<string, unknown>>

/** The suffix a template file carries and loses. */
const TEMPLATE_SUFFIX = '.template'

/**
 * The value a dotted path names in the substitutions.
 *
 * @param path - `name` or `name.member.member`
 * @param substitutions - The values
 * @returns The value, or undefined for a member that is not there
 * @throws {Error} When the first segment is not a substitution
 */
function lookup(path: string, substitutions: Substitutions): unknown {
  const [head, ...members] = path.split('.') as [string, ...string[]]
  if (!(head in substitutions)) throw createError(`${path} is not defined for the template`)
  let value: unknown = substitutions[head]
  for (const member of members) {
    if (typeof value !== 'object' || value === null) return undefined
    value = (value as Record<string, unknown>)[member]
  }
  return value
}

/**
 * The two string arguments of a `.replace("a", "b")` call.
 *
 * @param text - The text between the parentheses
 * @returns The search and the replacement
 * @throws {Error} When the arguments are not two quoted strings
 */
function replaceArguments(text: string): readonly [string, string] {
  const parts = text.split(',').map((part) => part.trim())
  const unquote = (part: string): string | null => {
    const quote = part.charAt(0)
    if ((quote !== '"' && quote !== "'") || !part.endsWith(quote) || part.length < 2) return null
    return part.slice(1, -1)
  }
  const [search, replacement] = parts.length === 2 ? (parts.map(unquote) as [string | null, string | null]) : [null, null]
  if (search === null || replacement === null) throw createError(`a template may only call replace with two quoted strings, not (${text})`)
  return [search, replacement]
}

/**
 * The text an expression renders as: the value a dotted path names, optionally with one
 * `.replace("search", "replacement")` applied; a missing member renders as nothing.
 *
 * @param expression - The text between `<%=` and `%>`
 * @param substitutions - The values
 * @returns The text
 */
export function renderExpression(expression: string, substitutions: Substitutions): string {
  const trimmed = expression.trim()
  const call = trimmed.indexOf('.replace(')
  if (call === -1) {
    const value = lookup(trimmed, substitutions)
    return value === undefined || value === null ? '' : String(value)
  }
  if (!trimmed.endsWith(')')) throw createError(`unterminated call in template expression: ${trimmed}`)
  const [search, replacement] = replaceArguments(trimmed.slice(call + '.replace('.length, -1))
  const value = lookup(trimmed.slice(0, call), substitutions)
  return (value === undefined || value === null ? '' : String(value)).replace(search, replacement)
}

/**
 * A template with every `<%= expression %>` rendered.
 *
 * @param template - The template text
 * @param substitutions - The values
 * @returns The rendered text
 * @throws {Error} When a tag is not closed
 */
export function renderTemplate(template: string, substitutions: Substitutions): string {
  const parts: string[] = []
  let cursor = 0
  for (;;) {
    const open = template.indexOf('<%', cursor)
    if (open === -1) break
    const close = template.indexOf('%>', open)
    if (close === -1) throw createError(`a template tag opened at offset ${open} is never closed`)
    parts.push(template.slice(cursor, open))
    const inner = template.slice(open + 2, close)
    parts.push(renderExpression(inner.startsWith('=') || inner.startsWith('-') ? inner.slice(1) : inner, substitutions))
    cursor = close + 2
  }
  parts.push(template.slice(cursor))
  return parts.join('')
}

/**
 * Writes every file of a template directory under a target directory of the tree.
 *
 * @param tree - The tree written to
 * @param source - The template directory, absolute
 * @param target - The directory the files land under, relative to the tree's root
 * @param substitutions - The values the templates name
 * @throws {Error} When the directory holds no file
 */
export function generateFiles(tree: Tree, source: string, target: string, substitutions: Substitutions): void {
  const entries = readdirSync(source, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  if (entries.length === 0) throw createError(`generateFiles: no files found in ${source}`)
  for (const entry of entries) {
    const file = join(entry.parentPath, entry.name)
    const relativePath = normalizePath(relative(source, file))
    const path = joinPathFragments(
      target,
      relativePath.endsWith(TEMPLATE_SUFFIX) ? relativePath.slice(0, -TEMPLATE_SUFFIX.length) : relativePath
    )
    tree.write(path, renderTemplate(readFileSync(file, 'utf8'), substitutions))
  }
}
