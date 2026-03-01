import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-exports-exist rule.
 */
export const RULE_NAME = 'lib-pkg-exports-exist'

/**
 * Checks if an export path points to an existing file.
 * For .js exports, also checks for corresponding .ts source files since
 * package.json exports typically point to compiled output, not source.
 *
 * @param exportPath - The relative export path from package.json.
 * @param projectRoot - The project root directory.
 * @returns True if the file (or its TypeScript source) exists.
 */
function exportPathExists(exportPath: string, projectRoot: string): boolean {
  // Remove leading ./ if present
  const normalizedPath = exportPath.startsWith('./') ? exportPath.slice(2) : exportPath
  const resolvedPath = join(projectRoot, normalizedPath)

  // Check if the exact path exists
  if (existsSync(resolvedPath)) {
    return true
  }

  // For .js/.mjs/.cjs files, check for corresponding TypeScript source
  // This is the standard pattern: exports point to compiled output,
  // but at lint-time only source files exist
  if (/\.(m?js|cjs)$/.test(resolvedPath)) {
    const tsPath = resolvedPath.replace(/\.(m?js|cjs)$/, '.ts')
    const mtsPath = resolvedPath.replace(/\.mjs$/, '.mts')
    const ctsPath = resolvedPath.replace(/\.cjs$/, '.cts')

    return existsSync(tsPath) || existsSync(mtsPath) || existsSync(ctsPath)
  }

  return false
}

/**
 * Checks if a path represents a package.json self-reference export.
 *
 * @param exportPath - The export path to check.
 * @returns True if the path is a package.json reference.
 */
function isPackageJsonExport(exportPath: string): boolean {
  return exportPath === './package.json' || exportPath === 'package.json'
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require that paths in package.json exports field point to existing files',
    },
    schema: [],
    messages: {
      exportPathNotFound: "Export path '{{ path }}' does not exist. Ensure the file exists or remove the export entry.",
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    return <Rule.RuleListener>(<unknown>{
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

        if (keyName !== 'exports') {
          return
        }

        const value = node.value
        if (value.type !== 'JSONObjectExpression') {
          return
        }

        for (const prop of value.properties) {
          /* istanbul ignore if -- type guard for jsonc-eslint-parser */
          if (prop.type !== 'JSONProperty') {
            continue
          }

          const propValue = prop.value

          // Handle simple string exports: "./path": "./src/file.js"
          if (propValue.type === 'JSONLiteral' && typeof propValue.value === 'string') {
            const exportPath = propValue.value

            // Skip package.json self-reference
            if (isPackageJsonExport(exportPath)) {
              continue
            }

            if (!exportPathExists(exportPath, projectRoot)) {
              context.report({
                node: <Rule.Node>(<unknown>propValue),
                messageId: 'exportPathNotFound',
                data: { path: exportPath },
              })
            }
          }

          // Handle conditional exports: "./path": { "import": "./src/file.mjs", "require": "./src/file.cjs" }
          if (propValue.type === 'JSONObjectExpression') {
            for (const conditionalProp of propValue.properties) {
              /* istanbul ignore if -- type guard for jsonc-eslint-parser */
              if (conditionalProp.type !== 'JSONProperty') {
                continue
              }

              const conditionalValue = conditionalProp.value
              if (conditionalValue.type === 'JSONLiteral' && typeof conditionalValue.value === 'string') {
                const exportPath = conditionalValue.value

                // Skip package.json self-reference
                if (isPackageJsonExport(exportPath)) {
                  continue
                }

                if (!exportPathExists(exportPath, projectRoot)) {
                  context.report({
                    node: <Rule.Node>(<unknown>conditionalValue),
                    messageId: 'exportPathNotFound',
                    data: { path: exportPath },
                  })
                }
              }
            }
          }
        }
      },
    })
  },
}

export default rule
