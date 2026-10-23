/**
 * Whether a `@returns` or `@yields` type lets the function give nothing: `undefined`, `void`,
 * `*`, `any`, or a union holding `undefined` or `void`.
 *
 * @module rules/jsdoc/shared/absent
 */

import type { JsdocTag } from '../../../jsdoc/parse'
import type { TypeNode } from '../../../jsdoc/types'
import { parseType } from '../../../jsdoc/types'

/** The types that admit an absent value on their own. */
const UNDEFINED_TYPES = ['undefined', 'void', '*', 'any']

/**
 * Whether a tag's type lets the function return nothing: `undefined`, `void`, `*`, `any`, or a
 * union holding `undefined` or `void`.
 *
 * @param tag - The `@returns` or `@yields` tag
 * @returns Whether a missing value matches the type
 *
 * @example Decide whether a function may return nothing
 * ```ts
 * // tags: {string | undefined}, {void}, {string}, {Promise<void>}
 * admitsUndefined(optionalName) // => true
 * admitsUndefined(voidReturn) // => true
 * admitsUndefined(plainString) // => false
 * admitsUndefined(promiseOfVoid) // => false (a promise is a value)
 * ```
 */
export function admitsUndefined(tag: JsdocTag): boolean {
  const type = tag.type.trim()
  if (UNDEFINED_TYPES.includes(type)) return true
  const { node } = parseType(type)
  if (node?.kind !== 'union') return false
  return (node.elements as readonly TypeNode[]).some(
    (element) => element.kind === 'name' && (element.value === 'undefined' || element.value === 'void')
  )
}
