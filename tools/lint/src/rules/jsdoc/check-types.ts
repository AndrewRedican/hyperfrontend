/**
 * Types are spelled as TypeScript spells them: a native type written in another case, such as
 * `String` or `regexp`, is reported with the preferred spelling, and the fix respells it; an
 * `object` or `Object` given type arguments is reported in favour of an index signature.
 *
 * @module rules/jsdoc/check-types
 */

import type { Node } from '../../code/model.ts'
import type { Fix } from '../../engine/report.ts'
import type { JsdocBlock, JsdocTag } from '../../jsdoc/parse.ts'
import type { TypeVisit } from './shared/type-walk.ts'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportTag } from './shared/report.ts'
import { isCheckedName, typedTags, typeVisits } from './shared/type-walk.ts'

/** The native types, spelled as preferred. */
const NATIVE = ['undefined', 'null', 'boolean', 'number', 'bigint', 'string', 'symbol', 'object', 'Array', 'Function', 'Date', 'RegExp']

/** A name to respell. */
interface Respelling {
  /** The name's visit. */
  readonly visit: TypeVisit
  /** The spelling preferred. */
  readonly preferred: string
}

/**
 * Whether a name heads a generic, `object<...>` or `Object.<...>`, which an index signature
 * should replace.
 *
 * @param visit - The name's visit
 * @returns Whether it heads a generic as `object` or `Object`
 */
function isObjectGeneric(visit: TypeVisit): boolean {
  const name = visit.node.value
  return visit.parent?.kind === 'generic' && visit.field === 'left' && (name === 'object' || name === 'Object')
}

/**
 * The native spelling a name should use, when it spells a native type in another case.
 *
 * @param visit - The name's visit
 * @returns The preferred spelling, or null
 */
function preferredSpelling(visit: TypeVisit): string | null {
  const name = visit.node.value as string
  for (const native of NATIVE) {
    // why: `object` is respelled only from `Object`, and not inside an `Object<...>`, which the previous linter left alone.
    if (native === 'object' && (name !== 'Object' || (visit.parent?.kind === 'generic' && visit.parent.left?.value === 'Object'))) continue
    if (native !== name && native.toLowerCase() === name.toLowerCase()) return native
  }
  return null
}

/**
 * The fix respelling names in a tag's type, at the first place the type is written in braces
 * in the block.
 *
 * @param text - The file's text
 * @param block - The block holding the tag
 * @param tag - The tag whose type is respelled
 * @param respellings - The names respelled
 * @returns The fix
 */
function respell(text: string, block: JsdocBlock, tag: JsdocTag, respellings: readonly Respelling[]): Fix {
  let fixed = tag.type
  for (const { visit, preferred } of [...respellings].reverse())
    fixed = `${fixed.slice(0, visit.node.start)}${preferred}${fixed.slice(visit.node.end)}`
  const start = block.start + text.slice(block.start, block.end).indexOf(`{${tag.type}}`)
  return { start, end: start + tag.type.length + 2, text: `{${fixed}}` }
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/check-types',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const { tag, root } of typedTags(block)) {
          const respellings: Respelling[] = []
          const found: (Respelling | string)[] = []
          for (const visit of typeVisits(root)) {
            if (!isCheckedName(visit)) continue
            const name = visit.node.value as string
            if (isObjectGeneric(visit)) {
              found.push(`Use object shorthand or index signatures instead of \`${name}\`, e.g., \`{[key: string]: string}\``)
              continue
            }
            const preferred = preferredSpelling(visit)
            if (preferred === null) continue
            respellings.push({ visit, preferred })
            found.push({ visit, preferred })
          }
          const fix = respellings.length === 0 ? undefined : respell(context.file.text, block, tag, respellings)
          const named = tag.name === '' ? '' : ` "${tag.name}"`
          for (const item of found) {
            if (typeof item === 'string') reportTag(context, tag, item)
            else
              reportTag(
                context,
                tag,
                `Invalid JSDoc @${tag.tag}${named} type ${stringify(item.visit.node.value)}; prefer: ${stringify(item.preferred)}.`,
                fix
              )
          }
        }
      }
    },
  }),
})
