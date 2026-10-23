/**
 * Every entry point of a publishable library opens with a JSDoc block carrying a `@module` tag
 * and a short description of the capability the module exposes: present, within a length band,
 * and saying more than the module path does.
 *
 * @module rules/workspace/lib-require-module-header
 */

import type { Node } from '@hyperfrontend/linter'
import { basename, dirname, join, posix, resolve } from 'node:path'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { positionAt } from '@hyperfrontend/linter/helpers'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'

/** The rule's options. */
export interface ModuleHeaderOptions {
  /** The longest description, in characters. */
  readonly maxDescriptionLength?: number
  /** The shortest description, in characters. */
  readonly minDescriptionLength?: number
  /** How many words the description must add beyond its module path and filler. */
  readonly minSubstantiveWords?: number
}

/** The message for a missing header. */
const MISSING =
  'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.'

/**
 * A word reduced to a crude stem: lower case, letters and digits, a plural ending dropped.
 *
 * @param word - A lower-case word of the module header
 * @returns The word without its inflectional ending
 */
function stem(word: string): string {
  const bare = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (bare.endsWith('ies') && bare.length > 4) return `${bare.slice(0, -3)}y`
  if (bare.endsWith('es') && bare.length > 4) return bare.slice(0, -2)
  if (bare.endsWith('s') && bare.length > 3) return bare.slice(0, -1)
  return bare
}

/** The words a description may use without saying anything, stemmed. */
const FILLER = createSet(
  'a an and api entry entrypoint export for from in index into it its library module of or package plus point the their this to with'
    .split(' ')
    .map(stem)
)

/**
 * The stemmed words of a text.
 *
 * @param text - A header or file name, any case
 * @returns The non-empty stems
 */
function stems(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9]+/)
    .map(stem)
    .filter((word) => word !== '')
}

/**
 * The description of a header holding a block tag: its text before the first one, links
 * unwrapped and whitespace collapsed.
 *
 * @param inner - The comment's text inside its delimiters
 * @returns The comment text after its leading asterisks, tags excluded
 */
function descriptionOf(inner: string): string {
  const text = inner
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*+\s?/, ''))
    .join('\n')
  // why: the header is read only once its `@module` tag is found, so a block tag always follows the description.
  const tag = /(^|\s)@[a-zA-Z]/.exec(text) as RegExpExecArray
  return text
    .slice(0, tag.index)
    .replace(/\{@link\s+([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The entry files a library's manifest declares: its main entry and each export mapped to a
 * source file.
 *
 * @param root - The library's root
 * @param exports - The manifest's exports
 * @returns The absolute paths
 */
function entriesOf(root: string, exports: unknown): string[] {
  const found = [join(root, 'src', 'index.ts')]
  if (exports === null || typeof exports !== 'object') return found
  for (const value of values(exports as Record<string, unknown>)) {
    const target =
      typeof value === 'string'
        ? value
        : ((value as Record<string, unknown>)['import'] ??
          (value as Record<string, unknown>)['require'] ??
          (value as Record<string, unknown>)['default'])
    if (typeof target !== 'string' || target.endsWith('package.json')) continue
    found.push(join(root, posix.normalize(target).replace(/\.(js|cjs|mjs)$/, '.ts')))
  }
  return found
}

export default defineRule<ModuleHeaderOptions | undefined, Node>({
  id: 'workspace/lib-require-module-header',
  language: 'code',
  fixable: false,
  create(context) {
    const { file } = context
    if (basename(file.path) !== 'index.ts') return {}
    const root = projectRootOf(dirname(file.path))
    if (root === null || !isPublishableLibrary(root)) return {}
    const manifest = readPackageFile(root)
    if (manifest === null || !entriesOf(root, manifest.exports).some((entry) => resolve(entry) === resolve(file.path))) return {}
    const max = context.options?.maxDescriptionLength ?? 200
    const min = context.options?.minDescriptionLength ?? 24
    const words = context.options?.minSubstantiveWords ?? 3
    return {
      Program(node) {
        const first = file.comments[0]
        const missing = (): void => context.report({ start: node.start, at: { line: 1, column: 1 }, message: MISSING })
        if (
          first === undefined ||
          file.text[first.start + 1] !== '*' ||
          !first.text.startsWith('*') ||
          positionAt(file.lines, first.start).line !== 1
        )
          return missing()
        const report = (message: string): void => context.report({ start: first.start, end: first.end, message })
        const tag = first.text.toLowerCase().indexOf('@module')
        const after = first.text[tag + 7]
        if (tag === -1 || (after !== undefined && after !== ' ' && after !== '\t' && after !== '\n' && after !== '\r'))
          return report(MISSING)
        const description = descriptionOf(first.text)
        if (description === '')
          return report(
            'The @module header must open with a description before its tags. Say in one or two sentences what capability this module exposes.'
          )
        if (description.length > max) {
          return report(
            `The @module description is ${description.length} characters; keep it to ${max}. It names what the module is responsible for, not how it works: move the walkthrough to the README or to the symbols it belongs to.`
          )
        }
        if (description.length < min)
          return report(
            `The @module description is ${description.length} characters; give it at least ${min}. Say what capability this module exposes.`
          )
        const path = /@module[ \t]+(\S+)/.exec(first.text)?.[1] ?? ''
        const fromPath = createSet(stems(path))
        const substantive = createSet(stems(description).filter((word) => !fromPath.has(word) && !FILLER.has(word)))
        if (substantive.size < words) {
          report(
            `The @module description adds nothing to the module path. Say what capability "${path}" exposes instead of restating its name.`
          )
        }
      },
    }
  },
})
