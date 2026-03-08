import type { Rule } from 'eslint'
import type { JSONNode, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, join } from 'node:path'
import { isPublishableLibrary, parseJsonFile } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-bundle-entry rule.
 */
export const RULE_NAME = 'lib-pkg-bundle-entry'

interface BuildOptions {
  iife?: { entry?: string }
  umd?: { entry?: string }
}

interface ProjectJson {
  targets?: {
    build?: {
      options?: BuildOptions
    }
  }
}

/**
 * Extracts bundle entries from project.json build configuration.
 *
 * @param projectRoot - Path to the project root.
 * @returns Array of bundle entry paths.
 */
function getBundleEntries(projectRoot: string): string[] {
  const projectJsonPath = join(projectRoot, 'project.json')
  const projectJson = parseJsonFile<ProjectJson>(projectJsonPath)

  if (!projectJson?.targets?.build?.options) {
    return []
  }

  const options = projectJson.targets.build.options
  const entries: string[] = []

  if (options.iife?.entry) {
    entries.push(options.iife.entry)
  }

  if (options.umd?.entry) {
    entries.push(options.umd.entry)
  }

  return [...new Set(entries)]
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require bundled output entries to exist in package.json exports',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-bundle-entry.md',
    },
    schema: [],
    messages: {
      missingBundleEntry:
        'Bundle entry \'{{ entry }}\' specified in project.json is not found in package.json exports. Add the export: "{{ entry }}": "./path/to/entry.js"',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    const bundleEntries = getBundleEntries(projectRoot)

    /* istanbul ignore next - valid projects without bundle config */
    if (bundleEntries.length === 0) {
      return {}
    }

    const exportKeys = new Set<string>()
    let exportsNode: JSONProperty | null = null

    return {
      JSONProperty(node: JSONNode) {
        /* istanbul ignore if -- type guard for jsonc-eslint-parser */
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

        if (keyName === 'exports') {
          exportsNode = node
          const value = node.value
          if (value.type === 'JSONObjectExpression') {
            for (const prop of value.properties) {
              /* istanbul ignore if -- type guard for jsonc-eslint-parser */
              if (prop.type !== 'JSONProperty') {
                continue
              }
              const propKey = prop.key
              if (propKey.type === 'JSONIdentifier') {
                exportKeys.add(propKey.name)
              } else if (propKey.type === 'JSONLiteral' && typeof propKey.value === 'string') {
                exportKeys.add(propKey.value)
              }
            }
          }
        }
      },

      'Program:exit'() {
        for (const entry of bundleEntries) {
          if (!exportKeys.has(entry)) {
            const reportNode = exportsNode ? (exportsNode as unknown as Rule.Node) : null
            context.report({
              node: reportNode,
              loc: reportNode ? undefined : { line: 1, column: 0 },
              messageId: 'missingBundleEntry',
              data: { entry },
            })
          }
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
