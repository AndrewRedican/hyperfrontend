/**
 * A bundled output declared as an object (`iife` or `umd`) names its entry and the global
 * variable a browser receives it under. A list of bundles is left to the build, which checks
 * each item itself.
 *
 * @module rules/workspace/lib-project-bundle-config
 */

import type { JsonObjectNode, JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { RuleContext } from '../../engine/rule.ts'
import type { JsonTreeNode } from '../../languages/json.ts'
import { basename, dirname } from 'node:path'
import { defineRule } from '../../engine/rule.ts'
import { isString, propertyOf } from '../shared/json.ts'
import { isPublishableLibrary } from './shared/project-file.ts'

/** The bundled formats. */
const FORMATS = ['iife', 'umd']

/**
 * Whether an object declares a field as a non-empty string.
 *
 * @param object - The bundle's object
 * @param name - The field
 * @returns True when the field is a string with text
 */
function declares(object: JsonObjectNode, name: string): boolean {
  const value = propertyOf(object, name)?.value
  return value !== undefined && isString(value) && value.value !== ''
}

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/lib-project-bundle-config',
  language: 'json',
  fixable: false,
  create(context: RuleContext<undefined, JsonTreeNode>) {
    if (basename(context.file.path) !== 'project.json' || !isPublishableLibrary(dirname(context.file.path))) return {}
    return {
      property(node) {
        const property = node as JsonPropertyNode
        if (property.value.kind !== 'object') return
        const format = property.key.value as string
        if (!FORMATS.includes(format)) return
        const where = { start: property.start, end: property.end }
        if (!declares(property.value, 'entry')) {
          context.report({
            ...where,
            message: `Bundled output '${format}' is missing required field 'entry'. Bundled outputs must specify their entry point.`,
          })
        }
        if (!declares(property.value, 'globalName')) {
          context.report({
            ...where,
            message: `Bundled output '${format}' is missing required field 'globalName'. Bundled outputs must specify a global variable name for browser consumption.`,
          })
        }
      },
    }
  },
})
