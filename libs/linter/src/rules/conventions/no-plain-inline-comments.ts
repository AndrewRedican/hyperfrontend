/**
 * A line comment says what kind of note it is: it opens with a hint prefix such as `why:` or
 * `how:`, or it is a tooling directive. A plain comment is removed with its line, or with the
 * space before it when it trails code. Configuration files and comments filling an otherwise
 * empty function or catch body are left alone.
 *
 * @module rules/conventions/no-plain-inline-comments
 */

import type { Node } from '../../code/model'
import { basename } from 'node:path'
import { defineRule } from '../../engine/rule'
import { positionAt } from '../../text/lines'
import { isLineComment } from './shared/comments'

/** What the rule reports, listing the allowed hint prefixes. */
const MESSAGE =
  'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:, compat:) or a tooling directive.'

/** The hint prefixes, each followed by a colon. */
const PREFIXES = ['why', 'how', 'context', 'magic', 'todo', 'fixme', 'note', 'ref', 'compat'].map((prefix) => `${prefix}:`)

/** What a tooling directive opens with, in lower case. */
const DIRECTIVES = [
  '@ts-ignore',
  '@ts-expect-error',
  '@ts-nocheck',
  '@ts-check',
  '/ <reference',
  'lint-disable',
  'lint-enable',
  'eslint-env',
  'istanbul ignore',
  'c8 ignore',
  'webpackchunkname',
  'webpackmode',
  'webpackprefetch',
  'webpackpreload',
  'webpackinclude',
  'webpackexclude',
  'vite-ignore',
  '<hf:',
  '</hf:',
  'prettier-ignore',
  '@vite-ignore',
  '@rollup-plugin-ignore',
  'sourcemappingurl',
  'sourceurl',
  'falls through',
  'fall through',
  'no default',
  'intentional fallthrough',
  'fallthrough',
]

/** What a configuration file's name holds, in lower case. */
const CONFIG_NAMES = [
  'tsconfig',
  'jest.config',
  'eslint.config',
  'eslint.base.config',
  'lint.config',
  'lint.base.config',
  '.eslintrc',
  'vite.config',
  'webpack.config',
  'rollup.config',
  'babel.config',
  '.babelrc',
  'prettier.config',
  '.prettierrc',
  'postcss.config',
  'tailwind.config',
  'next.config',
  'nuxt.config',
  'svelte.config',
  'angular.json',
  'nx.json',
  'project.json',
  'package.json',
  'vitest.config',
  'playwright.config',
  'cypress.config',
  'commitlint.config',
  'lint-staged.config',
  'lefthook',
]

/**
 * The body of a function or catch clause when it holds no statement.
 *
 * @param node - The function or catch clause
 * @returns The empty body, or null
 */
function emptyBody(node: Node): Node | null {
  const body = node.body as Node
  return body.kind === 'BlockStatement' && (body.body as readonly Node[]).length === 0 ? body : null
}

export default defineRule<undefined, Node>({
  id: 'no-plain-inline-comments',
  language: 'code',
  fixable: true,
  create(context) {
    const { file } = context
    const name = basename(file.path).toLowerCase()
    if (CONFIG_NAMES.some((pattern) => name.includes(pattern))) return {}
    const empty: Node[] = []
    const collect = (node: Node): void => {
      const body = emptyBody(node)
      if (body !== null) empty.push(body)
    }
    return {
      CatchClause: collect,
      FunctionDeclaration: collect,
      FunctionExpression: collect,
      ArrowFunctionExpression: collect,
      'Program:exit'() {
        for (const comment of file.comments) {
          if (!isLineComment(file, comment)) continue
          const content = comment.text.trim().toLowerCase()
          if (DIRECTIVES.some((directive) => content.startsWith(directive)) || PREFIXES.some((prefix) => content.startsWith(prefix)))
            continue
          if (empty.some((body) => comment.start >= body.start && comment.end <= body.end)) continue
          const lineStart = file.lines.starts[positionAt(file.lines, comment.start).line - 1] as number
          let start = comment.start
          let end = comment.end
          if (file.text.slice(lineStart, comment.start).trim() !== '') {
            while (start > lineStart && /\s/.test(file.text[start - 1] as string)) start -= 1
          } else {
            start = lineStart
            end += file.text.startsWith('\r\n', end) ? 2 : file.text[end] === '\n' ? 1 : 0
          }
          context.report({ start: comment.start, end: comment.end, message: MESSAGE, fix: { start, end, text: '' } })
        }
      },
    }
  },
})
