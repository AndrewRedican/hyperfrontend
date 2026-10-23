/**
 * A publishable library's `package.json` carries the fields the registry and the bundlers read:
 * name, description, license, sideEffects, engines and keywords.
 *
 * @module rules/workspace/lib-pkg-fields
 */

import { propertyOf, wholeDocument } from '@hyperfrontend/linter/helpers'
import { manifestRule } from './shared/manifest-rule.ts'

/** The required fields with the example each message suggests. */
const REQUIRED: readonly (readonly [string, string])[] = [
  ['name', '"name": "@hyperfrontend/my-lib"'],
  ['description', '"description": "Description of the library"'],
  ['license', '"license": "MIT"'],
  ['sideEffects', '"sideEffects": false'],
  ['engines', '"engines": { "node": ">=18.0.0" }'],
  ['keywords', '"keywords": ["keyword1", "keyword2"]'],
]

export default manifestRule('workspace/lib-pkg-fields', 'package.json', (root, context) => {
  for (const [field, example] of REQUIRED) {
    if (propertyOf(root, field) === null) {
      context.report({
        ...wholeDocument(context.file),
        message: `Publishable library package.json is missing required field '${field}'. Add: ${example}`,
      })
    }
  }
})
