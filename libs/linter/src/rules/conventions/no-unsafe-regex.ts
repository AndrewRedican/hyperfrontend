/**
 * No regular expression risks catastrophic backtracking: a literal or constant pattern holds no
 * nested repetition, no bound past a thousand and no repetition that takes quadratic time, and no
 * expression is built from a value the code does not spell out.
 *
 * @module rules/conventions/no-unsafe-regex
 */

import type { Node } from '../../code/model'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { defineRule } from '../../engine/rule'
import { polynomialRepetition } from './shared/polynomial'
import { isSafePattern } from './shared/star-height'

/** A regular expression literal's parts. */
interface RegexValue {
  /** The pattern's source. */
  readonly pattern: string
  /** The flags after the closing slash. */
  readonly flags: string
}

/** A template element's text. */
interface TemplateValue {
  /** The text with escapes applied. */
  readonly cooked: string | null
}

/** The largest bound a quantifier may name. */
const MAX_BOUND = 1000

/** A quantifier naming an upper bound. */
// lint-disable-next-line no-unsafe-regex -- two digit runs split by a comma and closed by a brace, no nested quantifier
const BOUND = /\{(\d+),(\d+)?\}/g

/** What the rule reports, by the reason a pattern is unsafe. */
const MESSAGES = {
  backtracking:
    'Regex pattern may cause catastrophic backtracking (ReDoS). Refactor to use non-nested quantifiers, avoid overlapping alternations, or use atomic groups.',
  dynamic:
    'RegExp constructed from non-literal value may be vulnerable to ReDoS if input is untrusted. Validate and sanitize input, or use a safe-regex library.',
  factory:
    'createRegExp() called with non-literal value may be vulnerable to ReDoS if input is untrusted. Validate and sanitize input before constructing the regex pattern.',
  template: 'Template literal in RegExp may inject unsafe patterns. Escape special regex characters or use literal patterns.',
}

/**
 * The text a pattern argument spells out: a string, or a template without substitutions.
 *
 * @param node - The argument
 * @returns The text, or null when the argument is computed
 */
function constantPattern(node: Node): string | null {
  if (node.kind === 'Literal' && typeof node.value === 'string') return node.value
  if (node.kind !== 'TemplateLiteral' || (node.expressions as readonly Node[]).length > 0) return null
  const quasi = (node.quasis as readonly Node[])[0] as Node
  // why: only a tagged template may leave an escape uncooked, and a tagged template is no template literal argument.
  return (quasi.value as TemplateValue).cooked as string
}

export default defineRule<undefined, Node>({
  id: 'no-unsafe-regex',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (pattern: string, flags: string, node: Node): void => {
      for (const match of pattern.matchAll(BOUND)) {
        if (match[2] === undefined || parseInt(match[2], 10) <= MAX_BOUND) continue
        context.report({
          start: node.start,
          end: node.end,
          message: `Quantifier bound \`${match[0]}\` exceeds safe threshold (${MAX_BOUND}). Use smaller bounds or process input in chunks.`,
        })
        return
      }
      if (!isSafePattern(pattern)) return context.report({ start: node.start, end: node.end, message: MESSAGES.backtracking })
      const slow = polynomialRepetition(pattern, flags)
      if (slow === null) return
      context.report({
        start: node.start,
        end: node.end,
        message: `Regex repetition \`${pattern.slice(slow.start, slow.end)}\` can take quadratic time (ReDoS): nothing anchors the pattern at its start, so after a failed match it is retried from every position of a long run. Anchor the pattern with \`^\`, have what precedes the repetition exclude the characters it repeats, or scan the string without a regex.`,
      })
    }
    const construction = (node: Node, factory: boolean): void => {
      const argument = (node.arguments as readonly Node[])[0]
      if (argument === undefined) return
      const pattern = constantPattern(argument)
      const flags = (node.arguments as readonly Node[])[1]
      if (pattern !== null) return check(pattern, (flags === undefined ? null : constantPattern(flags)) ?? '', node)
      const message = argument.kind === 'TemplateLiteral' ? MESSAGES.template : factory ? MESSAGES.factory : MESSAGES.dynamic
      context.report({ start: node.start, end: node.end, message })
    }
    return {
      Literal(node) {
        const regex = node.regex as RegexValue | undefined
        if (regex !== undefined) check(regex.pattern, regex.flags, node)
      },
      CallExpression(node) {
        const callee = node.callee as Node
        if (callee.kind === 'Identifier' && (callee.name === 'RegExp' || callee.name === 'createRegExp'))
          construction(node, callee.name !== 'RegExp')
      },
      NewExpression(node) {
        const callee = node.callee as Node
        if (callee.kind === 'Identifier' && callee.name === 'RegExp') construction(node, false)
      },
    }
  },
})
