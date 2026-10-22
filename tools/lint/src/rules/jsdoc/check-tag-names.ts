/**
 * Block and inline tags are ones JSDoc, TypeScript or TypeDoc know, or ones the configuration
 * defines; a synonym is replaced by its preferred name. Under `typed`, tags a type system makes
 * redundant are reported and removed.
 *
 * @module rules/jsdoc/check-tag-names
 */

import type { Node } from '../../code/model.ts'
import type { Fix } from '../../engine/report.ts'
import type { RuleContext } from '../../engine/rule.ts'
import type { JsdocBlock, JsdocTag } from '../../jsdoc/parse.ts'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { TAG_NAMES, TAG_PREFERENCES } from '../../jsdoc/tags.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportLine, reportTag } from './shared/report.ts'
import { blockTokens, removeTag, rewriteBlock } from './shared/rewrite.ts'

/** The options the rule takes. */
interface Options {
  /** Whether the code is typed, which makes some tags redundant. */
  readonly typed?: boolean
  /** Tags allowed beside the known ones. */
  readonly definedTags?: readonly string[]
}

/** The inline tags allowed. */
const INLINE_TAGS = createSet<string>(['link', 'linkcode', 'linkplain', 'tutorial', 'inheritDoc', 'label', 'include', 'includeCode'])

/** The tags a type system always makes redundant. */
const ALWAYS_REDUNDANT = createSet<string>([
  'augments',
  'callback',
  'class',
  'enum',
  'implements',
  'private',
  'property',
  'protected',
  'public',
  'readonly',
  'this',
  'type',
  'typedef',
])

/** The tags a type system makes redundant outside ambient declarations. */
const REDUNDANT_OUTSIDE_AMBIENT = createSet<string>([
  'abstract',
  'access',
  'class',
  'constant',
  'constructs',
  'enum',
  'export',
  'exports',
  'function',
  'global',
  'inherits',
  'instance',
  'interface',
  'member',
  'memberof',
  'memberOf',
  'method',
  'mixes',
  'mixin',
  'module',
  'name',
  'namespace',
  'override',
  'property',
  'requires',
  'static',
  'this',
])

/**
 * Whether a node sits in an ambient context: under a `declare`, or in a declaration file.
 *
 * @param node - The node the block documents
 * @param path - The file's path
 * @returns Whether its declarations are ambient
 */
function isAmbient(node: Node, path: string): boolean {
  for (let current: Node | null = node; current !== null; current = current.parent) {
    if (current.declare === true) return true
  }
  return path.endsWith('.d.ts')
}

/**
 * Whether a tag a type system makes redundant outside ambient declarations is redundant where
 * its block sits: the block documents a node outside a `declare` and outside a declaration
 * file's top level.
 *
 * @param context - The rule's context
 * @param tag - The tag checked
 * @param node - The node the block documents, or null
 * @returns Whether the tag is redundant
 */
function isRedundantHere(context: RuleContext<Options | undefined, Node>, tag: JsdocTag, node: Node | null): boolean {
  if (!REDUNDANT_OUTSIDE_AMBIENT.has(tag.tag) || node === null) return false
  const { path } = context.file
  if (path.endsWith('.d.ts') && (node.parent === null || node.parent.kind === 'Program')) return false
  return !isAmbient(node, path)
}

/**
 * The fix for a redundant tag: a tag with a description keeps it, its type dropped (and the tag
 * itself when it is always redundant); one without is removed.
 *
 * @param text - The file's text
 * @param block - The block holding the tag
 * @param tag - The tag the type system makes needless
 * @param always - Whether the tag itself goes too
 * @returns The replacement of the block
 */
function redundantFix(text: string, block: JsdocBlock, tag: JsdocTag, always: boolean): Fix {
  if (tag.description.trim() === '') return removeTag(text, block, tag)
  const lines = blockTokens(block)
  const first = lines[tag.index] as (typeof lines)[number]
  first.type = ''
  first.postType = ''
  if (always) {
    first.tag = ''
    first.postTag = ''
  }
  return rewriteBlock(block, lines)
}

/**
 * Whether a character is a word character.
 *
 * @param char - The character, or the empty string past the end
 * @returns Whether it is a letter, digit or underscore
 */
function isWord(char: string): boolean {
  return /\w/.test(char)
}

/**
 * The fix renaming the first use of a tag in a block: `@name` followed by a character whose
 * wordness differs from the name's last.
 *
 * @param text - The file's text
 * @param block - The block holding the synonym
 * @param name - The tag's name, a synonym ending in a word character
 * @param preferred - The name it becomes
 * @returns The replacement of the synonym
 */
function renameFix(text: string, block: JsdocBlock, name: string, preferred: string): Fix {
  const comment = text.slice(block.start, block.end)
  const needle = `@${name}`
  let at = comment.indexOf(needle)
  // how: the tag's own token ends at whitespace or the close, so the search stops at it at the latest.
  while (isWord(comment.charAt(at + needle.length))) at = comment.indexOf(needle, at + 1)
  return { start: block.start + at, end: block.start + at + needle.length, text: `@${preferred}` }
}

/**
 * Reports the inline tags of a block that are not allowed, on the line each sits on.
 *
 * @param context - The rule's context
 * @param block - The block searched
 */
function checkInline(context: RuleContext<Options | undefined, Node>, block: JsdocBlock): void {
  for (const line of block.lines) {
    const { description } = line.tokens
    for (let at = description.indexOf('{@'); at !== -1; at = description.indexOf('{@', at + 2)) {
      let end = at + 2
      while (end < description.length && !/[\s}]/.test(description[end] as string)) end += 1
      const name = description.slice(at + 2, end)
      if (!INLINE_TAGS.has(name)) reportLine(context, line, `Invalid JSDoc inline tag name "${name}"`)
    }
  }
}

export default defineRule<Options | undefined, Node>({
  id: 'jsdoc/check-tag-names',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program() {
      const typed = context.options?.typed === true
      const defined = context.options?.definedTags ?? []
      const { text } = context.file
      for (const { block, node } of fileBlocks(context)) {
        for (const tag of block.tags) {
          const name = tag.tag
          if (typed && ALWAYS_REDUNDANT.has(name)) {
            reportTag(context, tag, `'@${name}' is redundant when using a type system.`, redundantFix(text, block, tag, true))
            continue
          }
          if (typed && isRedundantHere(context, tag, node)) {
            const message = `'@${name}' is redundant outside of ambient (\`declare\`/\`.d.ts\`) contexts when using a type system.`
            reportTag(context, tag, message, redundantFix(text, block, tag, false))
            continue
          }
          if (typed && name === 'template' && tag.name === '') {
            reportTag(
              context,
              tag,
              `'@template' without a name is redundant when using a type system.`,
              redundantFix(text, block, tag, false)
            )
            continue
          }
          if (!TAG_NAMES.has(name) && !hasOwn(TAG_PREFERENCES, name) && name !== 'memberof!' && !defined.includes(name)) {
            reportTag(context, tag, `Invalid JSDoc tag name "${name}".`)
            continue
          }
          if (!hasOwn(TAG_PREFERENCES, name)) continue
          const preferred = TAG_PREFERENCES[name] as string
          const message = `Invalid JSDoc tag (preference). Replace "${name}" JSDoc tag with "${preferred}".`
          reportTag(context, tag, message, renameFix(text, block, name, preferred))
        }
        checkInline(context, block)
      }
    },
  }),
})
