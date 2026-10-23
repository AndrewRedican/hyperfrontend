/**
 * The tags that take a value carry a valid one: `@version` and `@since` a semantic version,
 * `@kind` a known kind, `@license` an SPDX expression, `@author` and `@variation` some text,
 * and `@import` an import declaration.
 *
 * @module rules/jsdoc/check-values
 */

import type { Node } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import type { JsdocTag } from '../../jsdoc/parse'
import { parseCode } from '../../code/parse'
import { defineRule } from '../../engine/rule'
import { fileBlocks } from './shared/blocks'
import { reportTag } from './shared/report'
import { isLicenseExpression } from './shared/spdx'
import { isSemver } from './shared/versions'

/** The kinds `@kind` may name. */
const KINDS = ['class', 'constant', 'event', 'external', 'file', 'function', 'member', 'mixin', 'module', 'namespace', 'typedef']

/**
 * Checks a `@license` tag: its first line holds an SPDX expression; each empty line before it
 * is a missing value.
 *
 * @param context - The rule's context
 * @param tag - The license tag checked
 */
function checkLicense(context: RuleContext<unknown, Node>, tag: JsdocTag): void {
  for (const line of tag.description.split(/\r\n|\r|\n/)) {
    if (line === '') {
      reportTag(context, tag, 'Missing JSDoc @license value.')
      continue
    }
    if (line.trim() !== '' && !isLicenseExpression(line)) {
      reportTag(context, tag, `Invalid JSDoc @license: "${line}"; expected SPDX expression: https://spdx.org/licenses/.`)
    }
    return
  }
}

/**
 * Whether an `@import` tag's text is an import declaration once `import` is put before it.
 *
 * @param tag - The import tag checked
 * @returns Whether it parses as one import declaration
 */
function isImport(tag: JsdocTag): boolean {
  const type = tag.type === '' ? '' : `{${tag.type}} `
  const text = `import ${tag.description === '' ? `${type}${tag.name}` : `${type}${tag.name} ${tag.description}`}`.trim()
  const parsed = parseCode(text, '.ts')
  const body = parsed.tree?.body as readonly Node[] | undefined
  const declaration = body?.length === 1 ? (body[0] as Node) : null
  const source = declaration?.kind === 'ImportDeclaration' ? (declaration.source as Node) : null
  // why: the code parser reads whatever token follows `from` as the module, so the quotes are checked here.
  const raw = source?.raw ?? ''
  return raw.length > 1 && (raw[0] === '"' || raw[0] === "'") && raw.at(-1) === raw[0]
}

/**
 * Checks a tag whose value is its whole description.
 *
 * @param context - The rule's context
 * @param tag - The tag holding a version, kind, author or variation
 */
function checkValue(context: RuleContext<unknown, Node>, tag: JsdocTag): void {
  const value = tag.description.trim()
  const name = tag.tag
  if (value === '') {
    reportTag(context, tag, `Missing JSDoc @${name} value.`)
    return
  }
  if ((name === 'version' || name === 'since') && !isSemver(value)) reportTag(context, tag, `Invalid JSDoc @${name}: "${value}".`)
  if (name === 'kind' && !KINDS.includes(value)) {
    reportTag(context, tag, `Invalid JSDoc @kind: "${value}"; must be one of: ${KINDS.join(', ')}.`)
  }
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/check-values',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const tag of block.tags) {
          if (tag.tag === 'license') checkLicense(context, tag)
          else if (tag.tag === 'import') {
            if (!isImport(tag)) reportTag(context, tag, 'Bad @import tag')
          } else if (['version', 'since', 'kind', 'author', 'variation'].includes(tag.tag)) checkValue(context, tag)
        }
      }
    },
  }),
})
