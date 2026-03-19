import type { Rule } from 'eslint'
import type { JSONNode, JSONObjectExpression, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-project-version-targets rule.
 */
export const RULE_NAME = 'lib-project-version-targets'

/**
 * Extracts the key name from a JSON property.
 *
 * @param prop - The JSON property node.
 * @returns The key name or null if not extractable.
 */
function getKeyName(prop: JSONProperty): string | null {
  const key = prop.key
  if (key.type === 'JSONIdentifier') return key.name
  if (key.type === 'JSONLiteral' && typeof key.value === 'string') return key.value
  return null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require version and version-check targets in publishable library project.json',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-project-version-targets.md',
    },
    schema: [],
    messages: {
      missingVersion: 'Publishable library must have "version" target for automated versioning. Add: "version": {} to targets.',
      missingVersionCheck: 'Publishable library must have "version-check" target for CI validation. Add: "version-check": {} to targets.',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    let targetsNode: JSONProperty | null = null
    let hasVersion = false
    let hasVersionCheck = false

    return {
      JSONProperty(node: JSONNode) {
        // istanbul ignore next -- type guard for jsonc-eslint-parser
        if (node.type !== 'JSONProperty') {
          return
        }

        const keyName = getKeyName(node)

        if (keyName === 'targets') {
          targetsNode = node
          const value = node.value
          if (value.type === 'JSONObjectExpression') {
            const targetsObj = value as JSONObjectExpression
            const targetNames = targetsObj.properties
              .filter((prop): prop is JSONProperty => prop.type === 'JSONProperty')
              .map(getKeyName)
              .filter((name): name is string => name !== null)

            hasVersion = targetNames.includes('version')
            hasVersionCheck = targetNames.includes('version-check')
          }
        }
      },

      'Program:exit'(node: JSONNode) {
        // Check version target exists
        if (!hasVersion) {
          context.report({
            node: (targetsNode ?? node) as unknown as Rule.Node,
            messageId: 'missingVersion',
          })
        }

        // Check version-check target exists
        if (!hasVersionCheck) {
          context.report({
            node: (targetsNode ?? node) as unknown as Rule.Node,
            messageId: 'missingVersionCheck',
          })
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
