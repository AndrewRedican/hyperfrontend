/**
 * A yield tag names the type of the values the generator yields: a block with a `@yields` or `@yield` tag without a type is reported.
 *
 * @module rules/jsdoc/require-yields-type
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { untypedTagListeners } from './shared/typed-tags'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-yields-type',
  language: 'code',
  fixable: false,
  create: (context) => untypedTagListeners(context, ['yields', 'yield'], '@yields should have a type'),
})
