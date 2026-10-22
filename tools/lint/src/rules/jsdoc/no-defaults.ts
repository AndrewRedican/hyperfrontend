/**
 * Defaults belong in the signature, not the docs: a `@param` name carrying `=value` in its
 * brackets and a `@default` tag carrying a value are reported, and the fix drops the default.
 *
 * @module rules/jsdoc/no-defaults
 */

import type { Node } from '../../code/model.ts'
import type { JsdocLine } from '../../jsdoc/parse.ts'
import { defineRule } from '../../engine/rule.ts'
import { replaceLine } from './shared/edits.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportTag } from './shared/report.ts'

/** The tags naming a parameter. */
const PARAMETERS = ['param', 'arg', 'argument']

/** The tags giving a default value. */
const DEFAULTS = ['default', 'defaultvalue']

export default defineRule<undefined, Node>({
  id: 'jsdoc/no-defaults',
  language: 'code',
  fixable: true,
  create: (context) =>
    documentedNodes(context, (_node, block) => {
      for (const tag of block.tags) {
        const line = tag.lines[0] as JsdocLine
        if (PARAMETERS.includes(tag.tag) && tag.default) {
          const fix = replaceLine(block, line, { ...line.tokens, name: `[${tag.name}]` })
          reportTag(context, tag, `Defaults are not permitted on @${tag.tag}.`, fix)
        } else if (DEFAULTS.includes(tag.tag) && tag.description.trim() !== '') {
          const fix = replaceLine(block, line, { ...line.tokens, postTag: '', description: '' })
          reportTag(context, tag, `Default values are not permitted on @${tag.tag}.`, fix)
        }
      }
    }),
})
