/**
 * A publishable library's `project.json` names itself with the `lib-` prefix, describes itself,
 * and carries at least one tag.
 *
 * @module rules/workspace/lib-project-metadata
 */

import { isString, propertyOf, wholeDocument } from '../shared/json.ts'
import { manifestRule } from './shared/manifest-rule.ts'

const MISSING_TAGS = 'Publishable library project.json is missing required field \'tags\'. Add: "tags": ["type:util", "scope:public"]'
const EMPTY_TAGS = "Publishable library project.json 'tags' field must be a non-empty array."
const MISSING_NAME = "Publishable library project.json is missing required field 'name'."
const INVALID_NAME = 'Publishable library project.json \'name\' must start with \'lib-\' prefix. Example: "name": "lib-my-library"'
const MISSING_DESCRIPTION =
  'Publishable library project.json is missing required field \'description\'. Add: "description": "Description of the library"'

export default manifestRule('workspace/lib-project-metadata', 'project.json', (root, context) => {
  const whole = wholeDocument(context.file)
  const name = propertyOf(root, 'name')
  if (name === null) context.report({ ...whole, message: MISSING_NAME })
  else if (!isString(name.value) || !name.value.value.startsWith('lib-')) context.report({ ...whole, message: INVALID_NAME })
  if (propertyOf(root, 'description') === null) context.report({ ...whole, message: MISSING_DESCRIPTION })
  const tags = propertyOf(root, 'tags')
  if (tags === null) context.report({ ...whole, message: MISSING_TAGS })
  else if (tags.value.kind !== 'array' || tags.value.elements.length === 0)
    context.report({ start: tags.start, end: tags.end, message: EMPTY_TAGS })
})
