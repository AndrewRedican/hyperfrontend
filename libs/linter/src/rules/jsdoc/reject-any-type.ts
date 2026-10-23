/**
 * A tag's type says more than that it may be anything: `any` and `*` are reported wherever they
 * appear.
 *
 * @module rules/jsdoc/reject-any-type
 */

import type { Node } from '../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule'
import { rejectedTypeListeners } from './shared/rejected-types'

/** The names rejected, with their messages. */
const REJECTED = createMap<string, string>([
  ['*', 'Prefer a more specific type to `*`'],
  ['any', 'Prefer a more specific type to `any`'],
])

export default defineRule<undefined, Node>({
  id: 'jsdoc/reject-any-type',
  language: 'code',
  fixable: false,
  create: (context) => rejectedTypeListeners(context, REJECTED),
})
