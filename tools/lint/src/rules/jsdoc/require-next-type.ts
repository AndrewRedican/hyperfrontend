/**
 * A next tag names the type of the values sent into the generator: a block with a `@next` tag without a type is reported.
 *
 * @module rules/jsdoc/require-next-type
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { untypedTagListeners } from './shared/typed-tags.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-next-type',
  language: 'code',
  fixable: false,
  create: (context) => untypedTagListeners(context, ['next'], '@next should have a type'),
})
