/**
 * A devcontainer installs no VS Code extension but the ones the configuration allows, so the
 * environment carries no editor tooling the workspace does not rely on.
 *
 * @module rules/workspace/no-vscode-extensions
 */

import type { JsonNode, JsonTreeNode } from '@hyperfrontend/linter'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { isString, propertyOf, rootObject } from '@hyperfrontend/linter/helpers'

/** The rule's options. */
interface Options {
  /** The extension identifiers a devcontainer may install, compared without regard to case. */
  readonly allow?: readonly string[]
}

/**
 * The value under a path of object keys.
 *
 * @param node - Where the path starts
 * @param keys - The keys, outermost first
 * @returns The value, or undefined when a step is missing or no object
 */
function valueAt(node: JsonNode, keys: readonly string[]): JsonNode | undefined {
  let current: JsonNode | undefined = node
  for (const key of keys) current = current?.kind === 'object' ? propertyOf(current, key)?.value : undefined
  return current
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/no-vscode-extensions',
  language: 'json',
  fixable: false,
  create(context) {
    const allowed = createSet((context.options?.allow ?? []).map((id) => id.toLowerCase()))
    return {
      document(node) {
        const root = rootObject(node)
        const extensions = root === null ? undefined : valueAt(root, ['customizations', 'vscode', 'extensions'])
        if (extensions?.kind !== 'array') return
        for (const element of extensions.elements) {
          if (!isString(element) || allowed.has(element.value.toLowerCase())) continue
          context.report({
            start: element.start,
            end: element.end,
            message: `The devcontainer installs the VS Code extension '${element.value}', which the workspace does not allow. Remove it, or add it to the rule's 'allow' option if the workspace relies on it.`,
          })
        }
      },
    }
  },
})
