import type { Rule } from 'eslint'
import type { JSONNode, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-project-metadata rule.
 */
export const RULE_NAME = 'lib-project-metadata'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require essential metadata in publishable library project.json files',
    },
    schema: [],
    messages: {
      missingTags: 'Publishable library project.json is missing required field \'tags\'. Add: "tags": ["type:util", "scope:public"]',
      emptyTags: "Publishable library project.json 'tags' field must be a non-empty array.",
      missingName: "Publishable library project.json is missing required field 'name'.",
      invalidNamePrefix: 'Publishable library project.json \'name\' must start with \'lib-\' prefix. Example: "name": "lib-my-library"',
      missingDescription:
        'Publishable library project.json is missing required field \'description\'. Add: "description": "Description of the library"',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    // istanbul ignore next -- fields initialization
    const fields: {
      name?: { value: string | null; node: JSONProperty }
      tags?: { value: unknown[] | null; node: JSONProperty }
      description?: { value: string | null; node: JSONProperty }
    } = {}

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

        if (keyName === 'name') {
          const value = node.value
          const nameValue = value.type === 'JSONLiteral' && typeof value.value === 'string' ? value.value : null
          fields.name = { value: nameValue, node }
        }

        if (keyName === 'tags') {
          const value = node.value
          let tagsValue: unknown[] | null = null
          if (value.type === 'JSONArrayExpression') {
            tagsValue = value.elements.map((el) => {
              /* istanbul ignore next - jsonc-eslint-parser always provides elements */
              if (!el) {
                return null
              }
              return el.type === 'JSONLiteral' ? el.value : null
            })
          }
          fields.tags = { value: tagsValue, node }
        }

        if (keyName === 'description') {
          const value = node.value
          const descValue = value.type === 'JSONLiteral' && typeof value.value === 'string' ? value.value : null
          fields.description = { value: descValue, node }
        }
      },

      'Program:exit'(node: JSONNode) {
        // Check tags
        if (!fields.tags) {
          context.report({
            node: <Rule.Node>(<unknown>node),
            messageId: 'missingTags',
          })
        } else if (!fields.tags.value || fields.tags.value.length === 0) {
          context.report({
            node: <Rule.Node>(<unknown>fields.tags.node),
            messageId: 'emptyTags',
          })
        }

        // Check name
        if (!fields.name) {
          context.report({
            node: <Rule.Node>(<unknown>node),
            messageId: 'missingName',
          })
        } else if (!fields.name.value || !fields.name.value.startsWith('lib-')) {
          context.report({
            node: <Rule.Node>(<unknown>fields.name.node),
            messageId: 'invalidNamePrefix',
          })
        }

        // Check description
        if (!fields.description || !fields.description.value) {
          context.report({
            node: <Rule.Node>(<unknown>node),
            messageId: 'missingDescription',
          })
        }
      },
    })
  },
}

export default rule
