/**
 * The shape every publishable-library manifest rule shares: it runs on one file name, only in a
 * directory whose `project.json` describes a publishable library, and receives the root object.
 *
 * @module rules/workspace/shared/manifest-rule
 */

import type { JsonObjectNode } from '@hyperfrontend/json-utils'
import type { JsonTreeNode, Listeners, RuleContext, RuleModule } from '@hyperfrontend/linter'
import { basename, dirname } from 'node:path'
import { rootObject } from '@hyperfrontend/linter/helpers'
import { isPublishableLibrary } from './project-file.ts'

/** What a manifest rule does with the root object. */
export type ManifestCheck<Options> = (root: JsonObjectNode, context: RuleContext<Options, JsonTreeNode>) => void

/**
 * Builds a rule that checks the root object of one manifest file of publishable libraries.
 *
 * @param id - What configurations call the rule, such as `workspace/lib-pkg-fields`
 * @param fileName - `package.json` or `project.json`
 * @param check - What to report, given the root object
 * @param fixable - Whether the rule offers fixes
 * @returns The rule module
 */
export function manifestRule<Options = undefined>(
  id: string,
  fileName: string,
  check: ManifestCheck<Options>,
  fixable = false
): RuleModule<Options, JsonTreeNode> {
  return {
    id,
    language: 'json',
    fixable,
    create(context): Listeners<JsonTreeNode> {
      if (basename(context.file.path) !== fileName || !isPublishableLibrary(dirname(context.file.path))) return {}
      return {
        document(node) {
          const root = rootObject(node)
          if (root !== null) check(root, context)
        },
      }
    },
  }
}
