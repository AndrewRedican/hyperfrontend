/**
 * A backslash before a character that needs none is noise that hides the escapes that matter:
 * in a regular expression, a character the grammar reads the same way bare, in a string or a
 * template, a character that is no escape and not the delimiter.
 *
 * @module rules/javascript/no-useless-escape
 */

import type { Node } from '../../code/model.ts'
import type { CharacterClassNode, CharacterNode, ExpressionCharacterClassNode } from '../../regex/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { defineRule } from '../../engine/rule.ts'
import { visit } from '../../regex/model.ts'
import { parse } from '../../regex/parse.ts'
import { isDigit } from '../../regex/reader.ts'

/** A class of either shape. */
type ClassNode = CharacterClassNode | ExpressionCharacterClassNode

/** The characters an escape may precede anywhere in a pattern. */
const GENERAL = '\\bcdDfnpPrsStvwWxu0123456789]'

/** The escapes allowed inside a character class. */
const CLASS_ESCAPES = createSet(GENERAL.split(''))

/** The escapes allowed outside a character class. */
const PATTERN_ESCAPES = createSet(`${GENERAL}^/.$*+?[{}|()Bk`.split(''))

/** The escapes allowed inside a character class under the `v` flag. */
const CLASS_SET_ESCAPES = createSet(`${GENERAL}q/[{}|()-`.split(''))

/** The punctuators a `v` class refuses doubled, which an escape keeps apart. */
const DOUBLE_PUNCTUATORS = createSet('!#$%&*+,.:;<=>?@^`~'.split(''))

/** The characters an escape may precede in a string or template, line terminators included. */
const STRING_ESCAPES = createSet([...'\\nrvtbfux'.split(''), '\n', '\r', ' ', ' '])

/**
 * The innermost class a character sits in.
 *
 * @param node - The character
 * @returns The class, or null outside every class
 */
function enclosingClass(node: CharacterNode): ClassNode | null {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.kind === 'CharacterClass' || current.kind === 'ExpressionCharacterClass') return current
  }
  return null
}

/**
 * Whether an escape the class grammar does not list is needed all the same: a caret that opens
 * the class, a dash in the middle of a flat class, or a punctuator a `v` class would otherwise
 * read doubled.
 *
 * @param pattern - The pattern text
 * @param node - The escaped character
 * @param cls - The class it sits in
 * @param escaped - The character escaped
 * @param unicodeSets - Whether the `v` flag is set
 * @returns True when the escape is needed
 */
function isNeededInClass(pattern: string, node: CharacterNode, cls: ClassNode, escaped: string, unicodeSets: boolean): boolean {
  if (escaped === '^' && cls.start + 1 === node.start) return true
  if (!unicodeSets) return escaped === '-' && cls.start + 1 !== node.start && node.end !== cls.end - 1
  if (!DOUBLE_PUNCTUATORS.has(escaped)) return false
  if (pattern[node.end] === escaped) return true
  if (pattern[node.start - 1] !== escaped) return false
  // why: the caret before the escape may be the class's own negation, which pairs with nothing.
  return escaped !== '^' || !cls.negate || cls.start + 1 < node.start - 1
}

/**
 * Whether an escape in a string or template is useless: no escape the language knows, and not
 * the delimiter; in a template, `\$` before `{` and `\{` after `$` keep a substitution literal.
 *
 * @param text - The literal's text, delimiters included
 * @param index - The offset of the backslash
 * @param escaped - The character escaped
 * @param template - Whether the text is a template's
 * @returns True when the escape is useless
 */
function isUselessStringEscape(text: string, index: number, escaped: string, template: boolean): boolean {
  if (template) {
    if (escaped === '$') return text[index + 2] !== '{'
    if (escaped === '{') return text[index - 1] !== '$'
    return escaped !== '`' && !STRING_ESCAPES.has(escaped)
  }
  return escaped !== text[0] && !STRING_ESCAPES.has(escaped)
}

export default defineRule<undefined, Node>({
  id: 'no-useless-escape',
  language: 'code',
  fixable: false,
  create(context) {
    const report = (offset: number, escaped: string): void => {
      context.report({ start: offset, end: offset + 1, message: `Unnecessary escape character: \\${escaped}.` })
    }
    const checkPattern = (node: Node, pattern: string, flags: string): void => {
      const parsed = parse(pattern, flags).pattern
      if (parsed === null) return
      const unicodeSets = flags.includes('v')
      visit(parsed, (item) => {
        if (item.kind !== 'Character' || !item.raw.startsWith('\\')) return
        const escaped = item.raw.slice(1)
        if (escaped !== fromCodePoint(item.value)) return
        const cls = enclosingClass(item)
        const allowed = cls === null ? PATTERN_ESCAPES : unicodeSets ? CLASS_SET_ESCAPES : CLASS_ESCAPES
        if (allowed.has(escaped) || (cls !== null && isNeededInClass(pattern, item, cls, escaped, unicodeSets))) return
        report(node.start + 1 + item.start, escaped)
      })
    }
    const checkText = (text: string, start: number, template: boolean): void => {
      let index = text.indexOf('\\')
      while (index !== -1) {
        const escaped = fromCodePoint(text.codePointAt(index + 1) as number)
        if (!isDigit(escaped) && isUselessStringEscape(text, index, escaped, template)) report(start + index, escaped)
        index = text.indexOf('\\', index + 1 + escaped.length)
      }
    }
    const checkQuasis = (node: Node): void => {
      for (const quasi of node.quasis as readonly Node[]) checkText(context.file.text.slice(quasi.start, quasi.end), quasi.start, true)
    }
    return {
      Literal(node) {
        if (node.regex !== undefined) checkPattern(node, node.regex.pattern, node.regex.flags)
        else if (typeof node.value === 'string' && (node.parent as Node).kind !== 'JSXAttribute')
          checkText(node.raw as string, node.start, false)
      },
      TemplateLiteral(node) {
        const parent = node.parent as Node
        // why: a tag sees the raw text, backslashes included, so nothing in its template is useless.
        if (parent.kind === 'TaggedTemplateExpression' && parent.quasi === node) return
        checkQuasis(node)
      },
      TSTemplateLiteralType: checkQuasis,
    }
  },
})
