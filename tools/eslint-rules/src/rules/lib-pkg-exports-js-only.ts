import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, extname } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-exports-js-only rule.
 */
export const RULE_NAME = 'lib-pkg-exports-js-only'

/**
 * Valid extensions for export paths in package.json.
 * Only compiled JavaScript and JSON files should be referenced.
 */
const VALID_EXTENSIONS = createSet<string>(['.js', '.mjs', '.cjs', '.json'])

/**
 * Checks if a path represents a package.json self-reference export.
 *
 * @param exportPath - The export path to check.
 * @returns True if the path is a package.json reference.
 */
function isPackageJsonExport(exportPath: string): boolean {
  return exportPath === './package.json' || exportPath === 'package.json'
}

/**
 * Checks if the extension is valid for an export path.
 *
 * @param exportPath - The export path to check.
 * @returns True if the extension is valid (.js, .mjs, .cjs, .json).
 */
function hasValidExtension(exportPath: string): boolean {
  const ext = extname(exportPath)
  return VALID_EXTENSIONS.has(ext)
}

/**
 * Gets the suggested .js replacement for a TypeScript extension.
 *
 * @param exportPath - The export path with a TypeScript extension.
 * @returns The suggested path with .js extension.
 */
function getSuggestedJsPath(exportPath: string): string {
  return exportPath.replace(/\.(ts|tsx|mts|cts)$/, (match) => {
    if (match === '.mts') return '.mjs'
    if (match === '.cts') return '.cjs'
    return '.js'
  })
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require only .js or .json extensions for relative paths in package.json exports field',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-exports-js-only.md',
    },
    fixable: 'code',
    schema: [],
    messages: {
      invalidExtension:
        "Export path '{{ path }}' has invalid extension '{{ ext }}'. Use '{{ suggested }}' instead. Package.json exports should reference compiled .js files, not source files.",
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    /**
     * Validates an export path and reports if the extension is invalid.
     *
     * @param valueNode - The AST node containing the export path.
     * @param exportPath - The export path string.
     */
    function validateExportPath(valueNode: JSONNode, exportPath: string): void {
      // Skip package.json self-reference
      if (isPackageJsonExport(exportPath)) {
        return
      }

      // Only check relative paths
      if (!exportPath.startsWith('./') && !exportPath.startsWith('../')) {
        return
      }

      if (!hasValidExtension(exportPath)) {
        const ext = extname(exportPath)
        const suggested = getSuggestedJsPath(exportPath)

        context.report({
          node: valueNode as unknown as Rule.Node,
          messageId: 'invalidExtension',
          data: {
            path: exportPath,
            ext: ext || '(no extension)',
            suggested,
          },
          fix(fixer) {
            // Only auto-fix TypeScript extensions to their JS equivalents
            if (/\.(ts|tsx|mts|cts)$/.test(exportPath)) {
              const raw = (valueNode as unknown as { raw?: string }).raw
              if (raw) {
                const quote = raw[0]
                return fixer.replaceText(valueNode as unknown as Rule.Node, `${quote}${suggested}${quote}`)
              }
            }
            return null
          },
        })
      }
    }

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
            validateExportPath(propValue, propValue.value)
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
                validateExportPath(conditionalValue, conditionalValue.value)
              }
            }
          }
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
