/**
 * A publishable library exports its own `package.json`, which tools read for metadata.
 *
 * @module rules/workspace/lib-pkg-package-json-export
 */

import { propertyOf } from '../shared/json.ts'
import { manifestRule } from './shared/manifest-rule.ts'

const MESSAGE =
  'Publishable library package.json must export "./package.json" for tool compatibility. Add: "./package.json": "./package.json"'

export default manifestRule('workspace/lib-pkg-package-json-export', 'package.json', (root, context) => {
  const exports = propertyOf(root, 'exports')
  if (exports === null) {
    context.report({ start: 0, message: MESSAGE })
    return
  }
  if (exports.value.kind !== 'object' || propertyOf(exports.value, './package.json') === null) {
    context.report({ start: exports.start, end: exports.end, message: MESSAGE })
  }
})
