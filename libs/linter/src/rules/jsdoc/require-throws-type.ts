/**
 * A throws tag names the type of what the function throws: a block with a `@throws` or `@exception` tag without a type is reported.
 *
 * @module rules/jsdoc/require-throws-type
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { untypedTagListeners } from './shared/typed-tags'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-throws-type',
  language: 'code',
  fixable: false,
  create: (context) => untypedTagListeners(context, ['throws', 'exception'], '@throws should have a type'),
})
