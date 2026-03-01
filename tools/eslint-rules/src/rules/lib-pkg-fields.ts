import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-fields rule.
 */
export const RULE_NAME = 'lib-pkg-fields'

/**
 * Required fields for publishable library package.json files.
 */
const REQUIRED_FIELDS = <const>['name', 'description', 'license', 'sideEffects', 'engines', 'keywords']

type RequiredField = (typeof REQUIRED_FIELDS)[number]

type MessageIds = 'missingName' | 'missingDescription' | 'missingLicense' | 'missingSideEffects' | 'missingEngines' | 'missingKeywords'

const messageIdMap: Record<RequiredField, MessageIds> = {
  name: 'missingName',
  description: 'missingDescription',
  license: 'missingLicense',
  sideEffects: 'missingSideEffects',
  engines: 'missingEngines',
  keywords: 'missingKeywords',
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require essential fields in publishable library package.json files',
    },
    schema: [],
    messages: {
      missingName: 'Publishable library package.json is missing required field \'name\'. Add: "name": "@hyperfrontend/my-lib"',
      missingDescription:
        'Publishable library package.json is missing required field \'description\'. Add: "description": "Description of the library"',
      missingLicense: 'Publishable library package.json is missing required field \'license\'. Add: "license": "MIT"',
      missingSideEffects: 'Publishable library package.json is missing required field \'sideEffects\'. Add: "sideEffects": false',
      missingEngines: 'Publishable library package.json is missing required field \'engines\'. Add: "engines": { "node": ">=18.0.0" }',
      missingKeywords: 'Publishable library package.json is missing required field \'keywords\'. Add: "keywords": ["keyword1", "keyword2"]',
    },
  },

  create(context) {
    // Get the file path being linted
    const filePath = context.filename || context.getFilename()
    const projectRoot = dirname(filePath)

    // Only apply to publishable libraries
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    const foundFields = new Set<string>()

    return <Rule.RuleListener>(<unknown>{
      /* istanbul ignore next - jsonc-eslint-parser always provides JSONProperty for object keys */
      JSONProperty(node: JSONNode) {
        if (node.type !== 'JSONProperty') {
          return
        }

        const key = node.key
        if (key.type === 'JSONIdentifier') {
          foundFields.add(key.name)
        } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
          foundFields.add(key.value)
        }
      },

      'Program:exit'(node: JSONNode) {
        for (const field of REQUIRED_FIELDS) {
          if (!foundFields.has(field)) {
            context.report({
              node: <Rule.Node>(<unknown>node),
              messageId: messageIdMap[field],
            })
          }
        }
      },
    })
  },
}

export default rule
