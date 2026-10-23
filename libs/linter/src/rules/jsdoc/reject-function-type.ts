/**
 * A function's type names its parameters and result: `Function` is reported wherever it
 * appears.
 *
 * @module rules/jsdoc/reject-function-type
 */

import type { Node } from '../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule'
import { rejectedTypeListeners } from './shared/rejected-types'

/** The names rejected, with their messages. */
const REJECTED = createMap<string, string>([['Function', 'Prefer a more specific type to `Function`']])

export default defineRule<undefined, Node>({
  id: 'jsdoc/reject-function-type',
  language: 'code',
  fixable: false,
  create: (context) => rejectedTypeListeners(context, REJECTED),
})
