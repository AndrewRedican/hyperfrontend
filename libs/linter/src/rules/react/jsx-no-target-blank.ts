/**
 * A link opening an external or dynamic address in a new tab with `target="_blank"` hands the
 * new page `window.opener` unless `rel` carries `noreferrer`; such an opening element is
 * reported, and fixed by adding or completing the `rel` attribute where its value is plain.
 *
 * @module rules/react/jsx-no-target-blank
 */

import type { Node, TemplateValue } from '../../code/model'
import type { Fix } from '../../engine/report'
import { defineRule } from '../../engine/rule'

/** The message reported. */
const MESSAGE =
  'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations'

/** An address with a scheme or a protocol-relative one: `x:` or `//` at the start. */
const EXTERNAL = /^(?:\w+:|\/\/)/

/**
 * The index of the last attribute with a name.
 *
 * @param attributes - The opening element's attributes and spreads
 * @param name - The attribute's name
 * @returns The index, or -1 when none has the name
 */
function lastIndexOf(attributes: readonly Node[], name: string): number {
  for (let index = attributes.length - 1; index >= 0; index -= 1) {
    const attribute = attributes[index] as Node
    if (attribute.kind === 'JSXAttribute' && (attribute.name as Node).name === name) return index
  }
  return -1
}

/**
 * Whether a value is a string reading `_blank` in any case.
 *
 * @param value - The literal value tested
 * @returns Whether it is `_blank`
 */
function isBlank(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase() === '_blank'
}

/**
 * Whether a `target` attribute may be `_blank`: a literal, quoted or in braces, or either branch
 * of a conditional in braces.
 *
 * @param attribute - The last `target` attribute, or undefined
 * @returns Whether it may open a new tab
 */
function isPossiblyBlank(attribute: Node | undefined): boolean {
  const value = attribute?.value as Node | null | undefined
  if (value === undefined || value === null) return false
  if (value.kind === 'Literal') return isBlank(value.value)
  if (value.kind !== 'JSXExpressionContainer') return false
  const expression = value.expression as Node
  if (expression.kind === 'Literal') return isBlank(expression.value)
  if (expression.kind !== 'ConditionalExpression') return false
  return isBlank((expression.alternate as Node).value) || isBlank((expression.consequent as Node).value)
}

/**
 * The values a `rel` attribute may take: a literal's value, a template's first text, a
 * conditional's two branch values (or the one paired with the `_blank` branch of a `target`
 * conditional on the same test name), or another expression's value field.
 *
 * @param rel - The `rel` attribute's value, or null when it has none
 * @param target - The `target` attribute's value, or null or undefined
 * @returns The candidate values
 */
function relValues(rel: Node | null, target: Node | null | undefined): unknown[] {
  if (rel === null) return [null]
  if (rel.kind === 'Literal') return [rel.value]
  const expression = rel.expression as Node
  if (expression.kind === 'TemplateLiteral') return [(((expression.quasis as readonly Node[])[0] as Node).value as TemplateValue).cooked]
  if (expression.kind !== 'ConditionalExpression') return [expression.value]
  const values = [(expression.consequent as Node).value, (expression.alternate as Node).value]
  const condition = target?.kind === 'JSXExpressionContainer' ? (target.expression as Node) : null
  if (condition === null || condition.kind !== 'ConditionalExpression') return values
  if ((condition.test as Node).name !== (expression.test as Node).name) return values
  const blank = [(condition.consequent as Node).value, (condition.alternate as Node).value].indexOf('_blank')
  return [values[blank]]
}

/**
 * Whether every value a `rel` attribute may take lists `noreferrer`.
 *
 * @param attributes - The opening element's attributes and spreads
 * @returns Whether the link is safe
 */
function hasSecureRel(attributes: readonly Node[]): boolean {
  const index = lastIndexOf(attributes, 'rel')
  if (index === -1) return false
  const target = attributes[lastIndexOf(attributes, 'target')]?.value as Node | null | undefined
  return relValues((attributes[index] as Node).value as Node | null, target).every(
    (value) => typeof value === 'string' && value.toLowerCase().split(' ').includes('noreferrer')
  )
}

/**
 * The value text a `rel` fix writes: the old value with `noreferrer` cut out and appended.
 *
 * @param value - The old string value
 * @returns The new value, quoted
 */
function withNoreferrer(value: string): string {
  return `"${[...value.split('noreferrer').filter((part) => part !== ''), 'noreferrer'].join(' ')}"`
}

/**
 * The fix for an unsafe link: a new `rel` after the last attribute, a value for a bare `rel`,
 * or a rewritten literal value; none when a spread could supply `rel` or the value is dynamic.
 *
 * @param attributes - The opening element's attributes and spreads
 * @returns The fix, or undefined
 */
function fixOf(attributes: readonly Node[]): Fix | undefined {
  const target = lastIndexOf(attributes, 'target')
  let spread = -1
  attributes.forEach((attribute, index) => {
    if (attribute.kind === 'JSXSpreadAttribute') spread = index
  })
  const rel = attributes.find((attribute) => attribute.kind === 'JSXAttribute' && (attribute.name as Node).name === 'rel')
  if (target < spread || (spread >= 0 && rel === undefined)) return undefined
  if (rel === undefined) {
    const last = attributes[attributes.length - 1] as Node
    return { start: last.end, end: last.end, text: ' rel="noreferrer"' }
  }
  const value = rel.value as Node | null
  if (value === null) return { start: rel.end, end: rel.end, text: '="noreferrer"' }
  if (value.kind === 'Literal') return { start: value.start, end: value.end, text: withNoreferrer(value.value as string) }
  const expression = value.expression as Node
  if (expression.kind !== 'Literal') return undefined
  if (typeof expression.value === 'string') return { start: expression.start, end: expression.end, text: withNoreferrer(expression.value) }
  return { start: value.start, end: value.end, text: '"noreferrer"' }
}

export default defineRule<undefined, Node>({
  id: 'react/jsx-no-target-blank',
  language: 'code',
  fixable: true,
  create: (context) => ({
    JSXOpeningElement(node) {
      if ((node.name as Node).name !== 'a') return
      const attributes = node.attributes as readonly Node[]
      if (!isPossiblyBlank(attributes[lastIndexOf(attributes, 'target')])) return
      const link = attributes[lastIndexOf(attributes, 'href')]?.value as Node | null | undefined
      const external = link?.kind === 'Literal' && EXTERNAL.test(link.value as string)
      const dynamic = attributes.some(
        (attribute) =>
          attribute.kind === 'JSXAttribute' &&
          (attribute.name as Node).name === 'href' &&
          (attribute.value as Node | null)?.kind === 'JSXExpressionContainer'
      )
      if ((!external && !dynamic) || hasSecureRel(attributes)) return
      context.report({ start: node.start, end: node.end, message: MESSAGE, fix: fixOf(attributes) })
    },
  }),
})
