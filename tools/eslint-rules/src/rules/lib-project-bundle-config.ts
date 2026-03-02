import type { Rule } from 'eslint'
import type { JSONNode, JSONObjectExpression, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-project-bundle-config rule.
 */
export const RULE_NAME = 'lib-project-bundle-config'

type BundleFormat = 'iife' | 'umd'

interface BundleIssue {
  format: BundleFormat
  node: JSONProperty
  missingEntry: boolean
  missingGlobalName: boolean
}

/**
 * Extracts the string value from a JSON property.
 *
 * @param prop - The JSON property node.
 * @returns The string value or null if not a string literal.
 */
function getPropertyStringValue(prop: JSONProperty): string | null {
  const value = prop.value
  /* istanbul ignore next - only string literals are checked */
  if (value.type === 'JSONLiteral' && typeof value.value === 'string') {
    return value.value
  }
  /* istanbul ignore next - fallback for non-string values */
  return null
}

/**
 * Finds a property in a JSON object expression by name.
 *
 * @param obj - The JSON object expression.
 * @param name - The name of the property to find.
 * @returns The found property or undefined.
 */
// istanbul ignore next - utility function
function findProperty(obj: JSONObjectExpression, name: string): JSONProperty | undefined {
  return <JSONProperty | undefined>(<unknown>obj.properties.find((prop) => {
    if (prop.type !== 'JSONProperty') {
      return false
    }
    const key = prop.key
    if (key.type === 'JSONIdentifier') {
      return key.name === name
    }
    if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
      return key.value === name
    }
    return false
  }))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require entry and globalName fields for bundled outputs (IIFE/UMD) in project.json',
    },
    schema: [],
    messages: {
      missingEntry: "Bundled output '{{ format }}' is missing required field 'entry'. Bundled outputs must specify their entry point.",
      missingGlobalName:
        "Bundled output '{{ format }}' is missing required field 'globalName'. Bundled outputs must specify a global variable name for browser consumption.",
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    const bundleIssues: BundleIssue[] = []

    return <Rule.RuleListener>(<unknown>{
      JSONProperty(node: JSONNode) {
        // istanbul ignore next -- type guard for jsonc-eslint-parser
        if (node.type !== 'JSONProperty') {
          return
        }

        const key = node.key
        let keyName: string | null = null

        if (key.type === 'JSONIdentifier') {
          keyName = key.name
        } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
          keyName = key.value
        }

        // Check for iife or umd configuration
        if (keyName === 'iife' || keyName === 'umd') {
          const value = node.value
          if (value.type === 'JSONObjectExpression') {
            const entryProp = findProperty(value, 'entry')
            const globalNameProp = findProperty(value, 'globalName')

            const hasEntry = entryProp ? !!getPropertyStringValue(entryProp) : false
            const hasGlobalName = globalNameProp ? !!getPropertyStringValue(globalNameProp) : false

            if (!hasEntry || !hasGlobalName) {
              bundleIssues.push({
                format: keyName,
                node,
                missingEntry: !hasEntry,
                missingGlobalName: !hasGlobalName,
              })
            }
          }
        }
      },

      'Program:exit'() {
        for (const issue of bundleIssues) {
          if (issue.missingEntry) {
            context.report({
              node: <Rule.Node>(<unknown>issue.node),
              messageId: 'missingEntry',
              data: { format: issue.format },
            })
          }
          if (issue.missingGlobalName) {
            context.report({
              node: <Rule.Node>(<unknown>issue.node),
              messageId: 'missingGlobalName',
              data: { format: issue.format },
            })
          }
        }
      },
    })
  },
}

export default rule
