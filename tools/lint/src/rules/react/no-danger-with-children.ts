/**
 * `dangerouslySetInnerHTML` replaces an element's children, so setting both is reported: on a
 * JSX element with children (or a `children` prop) and the HTML prop, read through spread
 * variables; and on a `createElement` call whose props carry the HTML prop while children are
 * passed as arguments or as a prop.
 *
 * @module rules/react/no-danger-with-children
 */

import type { Node } from '../../code/model.ts'
import type { Definition } from '../../scope/model.ts'
import type { LineMap } from '../../text/lines.ts'
import { defineRule } from '../../engine/rule.ts'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'
import { positionAt } from '../../text/lines.ts'

/** The message reported. */
const MESSAGE = 'Only set one of `children` or `props.dangerouslySetInnerHTML`'

export default defineRule<undefined, Node>({
  id: 'react/no-danger-with-children',
  language: 'code',
  fixable: false,
  create(context) {
    const initialiserOf = (from: Node, name: unknown): Node | null => {
      if (typeof name !== 'string') return null
      const variable = findVariable(scopeOf(scopeAnalysisOf(context), from), name)
      if (variable === null || variable.defs.length === 0) return null
      return ((variable.defs[0] as Definition).node.init as Node | null | undefined) ?? null
    }
    const objectHas = (object: Node, name: string, seen: readonly string[]): boolean => {
      const properties = object.properties as readonly Node[] | undefined
      if (properties === undefined) return false
      return properties.some((property) => {
        if (property.kind === 'Property') return (property.key as Node).name === name
        const spread = (property.argument as Node).name as string | undefined
        const init = initialiserOf(object, spread)
        if (init === null || seen.includes(spread as string)) return false
        return objectHas(init, name, [...seen, spread as string])
      })
    }
    const elementHas = (element: Node, name: string): boolean =>
      ((element.openingElement as Node).attributes as readonly Node[]).some((attribute) => {
        if (attribute.kind === 'JSXAttribute') return (attribute.name as Node).name === name
        const init = initialiserOf(element, (attribute.argument as Node).name)
        return init !== null && objectHas(init, name, [])
      })
    return {
      JSXElement(node) {
        const first = (node.children as readonly Node[])[0]
        const children = first !== undefined && !isLineBreak(context.file.lines, first) ? true : elementHas(node, 'children')
        if (!children || !elementHas(node, 'dangerouslySetInnerHTML')) return
        context.report({ start: node.start, end: node.end, message: MESSAGE })
      },
      CallExpression(node) {
        const callee = node.callee as Node
        const args = node.arguments as readonly Node[]
        if (callee.kind !== 'MemberExpression' || (callee.property as Node).name !== 'createElement' || args.length < 2) return
        let props = args[1] as Node
        if (props.kind === 'Identifier') props = initialiserOf(node, props.name) ?? props
        if (!objectHas(props, 'dangerouslySetInnerHTML', [])) return
        if (args.length === 2 && !objectHas(props, 'children', [])) return
        context.report({ start: node.start, end: node.end, message: MESSAGE })
      },
    }
  },
})

/**
 * Whether a child is only whitespace spanning a line break, which does not count as children.
 *
 * @param lines - The file's line map, for the child's lines
 * @param child - The first child of an element
 * @returns Whether the child is a line break of whitespace
 */
function isLineBreak(lines: LineMap, child: Node): boolean {
  if (child.kind !== 'JSXText' || (child.value as string).trim() !== '') return false
  return positionAt(lines, child.start).line !== positionAt(lines, child.end).line
}
