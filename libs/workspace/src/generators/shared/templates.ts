/**
 * Writes a directory of templates into a tree: each file lands under the target with its
 * `.template` suffix dropped, and every `<%= expression %>` in it replaced by the value the
 * substitutions hold for it. A text that a template writes into a block comment is first put
 * the way a comment holds it.
 *
 * @module generators/shared/templates
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

/** What ends a block comment, which no text written into one may hold as it is. */
export const COMMENT_END = '*/'

/** How the text of a block comment writes those two characters without ending it. */
const COMMENT_END_APART = '*\\/'

/** What starts each further line of a block comment. */
const COMMENT_LINE = ' *'

/** The start of a line that a block comment would read as a tag: its indentation, then an at sign and the word it opens. */
const TAG_LEAD = /^([ \t]*)(@[\w/.-]*)/

/** The punctuation a word may end in, which stays outside the backticks the word is wrapped in. */
const WORD_PUNCTUATION = '_/.-'

/** What a description wraps a word in for a comment to read it as text. */
const CODE_MARK = '`'

/**
 * A line of a description with the word that opens it wrapped in backticks where that word
 * starts with an at sign, which a block comment would otherwise read as a tag.
 *
 * @param line - One line of the description
 * @returns The line a comment reads as text, or the line as it is when no at sign opens it
 */
function withoutTagLead(line: string): string {
  return line.replace(TAG_LEAD, (_lead, indent: string, word: string) => {
    let end = word.length
    // why: the at sign itself is always wrapped, so the scan stops before it
    while (end > 1 && WORD_PUNCTUATION.includes(word.charAt(end - 1))) end -= 1
    return `${indent}${CODE_MARK}${word.slice(0, end)}${CODE_MARK}${word.slice(end)}`
  })
}

/**
 * A text as the lines of a block comment hold it, for a template that writes a description into
 * one: the two characters that would end the comment are written apart, a word that opens a line
 * with an at sign, which a comment would read as a tag, is wrapped in backticks, and each further
 * line starts as a line of the comment does.
 *
 * @param text - The text as given, of one line or several
 * @returns The text to write after the lead of a comment line
 *
 * @example A description that would end the comment it is written into, or open a tag in it
 * ```typescript
 * commentText('Finds src/**\/*.ts') // => 'Finds src/**\\/*.ts', which a reader of the comment sees as the same glob
 * commentText('First.\n\nSecond.') // => 'First.\n *\n * Second.'
 * commentText("@acme/core's test helpers.") // => "`@acme/core`'s test helpers."
 * ```
 */
export function commentText(text: string): string {
  return text
    .replaceAll(COMMENT_END, COMMENT_END_APART)
    .split(/\r?\n|\r/)
    .map(withoutTagLead)
    .map((line, index) => (index === 0 ? line : `${COMMENT_LINE}${line === '' ? '' : ` ${line}`}`))
    .join('\n')
}

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
 *
 * @example Dotted paths and the one call a template may make
 * ```typescript
 * const substitutions = { names: names('data-utils'), packageName: '@acme/data-utils' }
 * renderExpression('names.className', substitutions) // => 'DataUtils'
 * renderExpression('packageName.replace("@", "")', substitutions) // => 'acme/data-utils'
 * renderExpression('names.missing', substitutions) // => ''
 * renderExpression('other', substitutions) // throws: other is not defined for the template
 * ```
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
 *
 * @example Rendering one template text
 * ```typescript
 * renderTemplate('export class <%= names.className %> {}\n', { names: names('data-utils') })
 * // => 'export class DataUtils {}\n'
 * ```
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

/** How a template directory is written. */
export interface GenerateFilesOptions {
  /** Whether a file already at its target is left as it is, so a re-run changes nothing a hand has written since */
  readonly keepExisting?: boolean
}

/**
 * The path a template file lands at: under the target, with its suffix dropped.
 *
 * @param source - The template directory, absolute
 * @param file - The template file, absolute
 * @param target - The directory the files land under, relative to the tree's root
 * @returns The path relative to the tree's root
 */
function targetPath(source: string, file: string, target: string): string {
  const relativePath = normalizePath(relative(source, file))
  return joinPathFragments(target, relativePath.endsWith(TEMPLATE_SUFFIX) ? relativePath.slice(0, -TEMPLATE_SUFFIX.length) : relativePath)
}

/**
 * Writes every file of a template directory under a target directory of the tree.
 *
 * @param tree - The tree written to
 * @param source - The template directory, absolute
 * @param target - The directory the files land under, relative to the tree's root
 * @param substitutions - The values the templates name
 * @param options - Whether files already there are kept
 * @throws {Error} When the directory holds no file
 *
 * @example A generator's `files` directory written under the project
 * ```typescript
 * import { join } from 'node:path'
 * import { generateFiles, names } from '@hyperfrontend/workspace/generators'
 *
 * // files/src/index.ts.template holds: export const <%= names.propertyName %> = '<%= names.name %>'
 * generateFiles(tree, join(import.meta.dirname, 'files'), 'libs/data-utils', { names: names('data-utils') }, { keepExisting: true })
 * // writes libs/data-utils/src/index.ts holding "export const dataUtils = 'data-utils'", unless the file is already there
 * ```
 */
export function generateFiles(
  tree: Tree,
  source: string,
  target: string,
  substitutions: Substitutions,
  options: GenerateFilesOptions = {}
): void {
  const entries = readdirSync(source, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  if (entries.length === 0) throw createError(`generateFiles: no files found in ${source}`)
  for (const entry of entries) {
    const file = join(entry.parentPath, entry.name)
    const path = targetPath(source, file, target)
    if (options.keepExisting === true && tree.exists(path)) continue
    tree.write(path, renderTemplate(readFileSync(file, 'utf8'), substitutions))
  }
}
