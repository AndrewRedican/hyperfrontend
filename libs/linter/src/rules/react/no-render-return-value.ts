/**
 * `ReactDOM.render` returns a legacy instance reference; depending on it (assigning, returning
 * or storing it) is reported. Which objects count depends on the React version: `ReactDOM` from
 * 15 on, `React` or `ReactDOM` in 0.14, `React` in 0.13.
 *
 * @module rules/react/no-render-return-value
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { atLeast, caret, reactVersion } from './shared/settings'

/** The parents through which a call's value is depended on. */
const DEPENDENTS = createSet<string>([
  'VariableDeclarator',
  'Property',
  'ReturnStatement',
  'ArrowFunctionExpression',
  'AssignmentExpression',
])

/**
 * The objects whose `render` is checked under a version.
 *
 * @param settings - The settings of the blocks that matched the file
 * @returns The object names
 */
function renderersOf(settings: Readonly<Record<string, unknown>>): readonly string[] {
  const version = reactVersion(settings)
  if (atLeast(version, [15, 0, 0])) return ['ReactDOM']
  if (caret(version, [0, 14, 0])) return ['React', 'ReactDOM']
  if (caret(version, [0, 13, 0])) return ['React']
  return ['ReactDOM']
}

export default defineRule<undefined, Node>({
  id: 'react/no-render-return-value',
  language: 'code',
  fixable: false,
  create(context) {
    const renderers = renderersOf(context.settings)
    return {
      CallExpression(node) {
        const callee = node.callee as Node
        if (callee.kind !== 'MemberExpression' || callee.computed === true) return
        const object = callee.object as Node
        const property = callee.property as Node
        if (object.kind !== 'Identifier' || !renderers.includes(object.name as string)) return
        if (property.name !== 'render') return
        if (!DEPENDENTS.has((node.parent as Node).kind)) return
        context.report({
          start: callee.start,
          end: callee.end,
          message: `Do not depend on the return value from ${object.name as string}.render`,
        })
      },
    }
  },
})
