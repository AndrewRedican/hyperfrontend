/**
 * On a DOM element, an attribute React does not know is reported: renamed HTML and SVG names
 * are fixed to the name React uses, case slips are fixed to the known name, properties allowed
 * on some tags only are reported elsewhere, and anything else is reported as unknown. Data and
 * ARIA attributes, components, custom elements and `is` elements are left alone.
 *
 * @module rules/react/no-unknown-property
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { ANY_CASE, ARIA, POINTER_PROPERTIES, PROPERTIES, RENAMED, TAGS_BY_PROPERTY } from './shared/dom-properties.ts'
import { atLeast, reactVersion } from './shared/settings.ts'

/**
 * Whether a name is a data attribute: `data` or `data-` and more, without a colon, not starting
 * `data-xml` in any case.
 *
 * @param name - The attribute's name as written
 * @returns Whether React passes it through as data
 */
function isDataAttribute(name: string): boolean {
  if ((name !== 'data' && !name.startsWith('data-')) || name.includes(':')) return false
  return !name.toLowerCase().startsWith('data-xml')
}

/**
 * Whether an opening element is a DOM element React checks: a lower-case name without a dash,
 * and no `is` attribute.
 *
 * @param element - The opening element
 * @returns Whether its attributes are checked against the DOM
 */
function isDomElement(element: Node): boolean {
  const name = (element.name as Node).name
  if (typeof name !== 'string' || name.includes('-')) return false
  const first = name[0] as string
  if (first < 'a' || first > 'z') return false
  const attributes = element.attributes as readonly Node[]
  return !attributes.some((attribute) => attribute.kind === 'JSXAttribute' && (attribute.name as Node).name === 'is')
}

export default defineRule<undefined, Node>({
  id: 'react/no-unknown-property',
  language: 'code',
  fixable: true,
  create(context) {
    const version = reactVersion(context.settings)
    const transparency = !atLeast(version, [16, 1, 0])
    const pointer = atLeast(version, [16, 4, 0])
    const standardNameOf = (name: string): string | undefined => {
      const renamed = RENAMED.get(name)
      if (renamed !== undefined) return renamed
      const lower = name.toLowerCase()
      const known = PROPERTIES.get(lower)
      if (known !== undefined) return known
      if (transparency) return lower === 'allowtransparency' ? 'allowTransparency' : undefined
      return pointer ? POINTER_PROPERTIES.get(lower) : undefined
    }
    return {
      JSXAttribute(node) {
        const nameNode = node.name as Node
        const actual = context.file.text.slice(nameNode.start, nameNode.end)
        const name = ANY_CASE.find((candidate) => candidate.toLowerCase() === actual.toLowerCase()) ?? actual
        const element = node.parent as Node
        if ((element.name as Node).kind === 'JSXMemberExpression') return
        if (isDataAttribute(name) || ARIA.has(name)) return
        const tag = (element.name as Node).name
        if (tag === 'fbt' || tag === 'fbs' || !isDomElement(element)) return
        const tags = TAGS_BY_PROPERTY.get(name)
        if (tags !== undefined) {
          if (tags.includes(tag as string)) return
          context.report({
            start: node.start,
            end: node.end,
            message: `Invalid property '${actual}' found on tag '${tag as string}', but it is only allowed on: ${tags.join(', ')}`,
          })
          return
        }
        const standard = standardNameOf(name)
        if (standard === name) return
        if (standard === undefined) {
          context.report({ start: node.start, end: node.end, message: `Unknown property '${actual}' found` })
          return
        }
        context.report({
          start: node.start,
          end: node.end,
          message: `Unknown property '${actual}' found, use '${standard}' instead`,
          fix: { start: nameNode.start, end: nameNode.end, text: standard },
        })
      },
    }
  },
})
