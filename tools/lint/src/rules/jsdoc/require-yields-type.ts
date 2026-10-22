/**
 * A yield tag names the type of the values the generator yields: a block with a `@yields` or `@yield` tag without a type is reported.
 *
 * @module rules/jsdoc/require-yields-type
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { untypedTagListeners } from './shared/typed-tags.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-yields-type',
  language: 'code',
  fixable: false,
  create: (context) => untypedTagListeners(context, ['yields', 'yield'], '@yields should have a type'),
})
