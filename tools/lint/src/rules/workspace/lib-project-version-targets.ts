/**
 * A publishable library declares the `version` and `version-check` targets the release flow
 * runs.
 *
 * @module rules/workspace/lib-project-version-targets
 */

import { propertyOf, wholeDocument } from '@hyperfrontend/linter/helpers'
import { manifestRule } from './shared/manifest-rule.ts'

const MISSING_VERSION = 'Publishable library must have "version" target for automated versioning. Add: "version": {} to targets.'
const MISSING_VERSION_CHECK = 'Publishable library must have "version-check" target for CI validation. Add: "version-check": {} to targets.'

export default manifestRule('workspace/lib-project-version-targets', 'project.json', (root, context) => {
  const targets = propertyOf(root, 'targets')
  const where = targets === null ? wholeDocument(context.file) : { start: targets.start, end: targets.end }
  const declared = targets !== null && targets.value.kind === 'object' ? targets.value : null
  if (declared === null || propertyOf(declared, 'version') === null) context.report({ ...where, message: MISSING_VERSION })
  if (declared === null || propertyOf(declared, 'version-check') === null) context.report({ ...where, message: MISSING_VERSION_CHECK })
})
