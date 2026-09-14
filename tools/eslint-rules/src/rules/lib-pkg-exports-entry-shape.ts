import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { basename, dirname, extname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-exports-entry-shape rule.
 */
export const RULE_NAME = 'lib-pkg-exports-entry-shape'

/** Prefix every entry module path starts with. */
const SOURCE_PREFIX = './src/'

/** File name every entry module carries, before its extension. */
const ENTRY_BASENAME = 'index'

/**
 * Checks if a path represents a package.json self-reference export.
 *
 * @param exportPath - The export path to check.
 * @returns True if the path is a package.json reference.
 */
function isPackageJsonExport(exportPath: string): boolean {
  return exportPath === './package.json' || exportPath === 'package.json'
}

/** Suffix a declaration file carries between its base name and its extension. */
const DECLARATION_SUFFIX = '.d'

/**
 * Checks if a file name is an entry module file: `index.<ext>`, or the
 * declaration form `index.d.<ext>` a `types` condition may point at.
 *
 * @param file - The last path segment.
 * @returns True if the file is an index module or its declaration.
 */
function isEntryFile(file: string): boolean {
  const ext = extname(file)
  if (ext === '') {
    return false
  }
  const stem = basename(file, ext)
  return stem === ENTRY_BASENAME || stem === `${ENTRY_BASENAME}${DECLARATION_SUFFIX}`
}

/**
 * Checks if an export path names an entry module the build discovers:
 * `./src/index.<ext>` or `./src/<dir>/index.<ext>` with a plain directory
 * path in between (no empty, `.` or `..` segments).
 *
 * @param exportPath - The export path to check.
 * @returns True if the path is an entry module path.
 */
function isEntryModulePath(exportPath: string): boolean {
  if (!exportPath.startsWith(SOURCE_PREFIX)) {
    return false
  }
  const segments = exportPath.slice(SOURCE_PREFIX.length).split('/')
  if (!isEntryFile(segments[segments.length - 1] ?? '')) {
    return false
  }
  return segments.slice(0, -1).every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require every relative path in a publishable package.json exports field to name a src/**/index entry module',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-exports-entry-shape.md',
    },
    schema: [],
    messages: {
      notAnEntryModule:
        "Export path '{{ path }}' is not an entry module. Point it at './src/index.<ext>' or './src/<dir>/index.<ext>': the build discovers entries only there, and a subpath mapped anywhere else is dropped from the published exports.",
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    // why: only publishable libraries are linted via config
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    /**
     * Validates an export path and reports if it is not an entry module path.
     *
     * @param valueNode - The AST node containing the export path.
     * @param exportPath - The export path string.
     */
    function validateExportPath(valueNode: JSONNode, exportPath: string): void {
      if (isPackageJsonExport(exportPath)) {
        return
      }

      if (!exportPath.startsWith('./') && !exportPath.startsWith('../')) {
        return
      }

      if (!isEntryModulePath(exportPath)) {
        context.report({
          node: valueNode as unknown as Rule.Node,
          messageId: 'notAnEntryModule',
          data: { path: exportPath },
        })
      }
    }

    return {
      JSONProperty(node: JSONNode) {
        // why: type guard for jsonc-eslint-parser
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
          // why: type guard for jsonc-eslint-parser
          if (prop.type !== 'JSONProperty') {
            continue
          }

          const propValue = prop.value

          if (propValue.type === 'JSONLiteral' && typeof propValue.value === 'string') {
            validateExportPath(propValue, propValue.value)
          }

          if (propValue.type === 'JSONObjectExpression') {
            for (const conditionalProp of propValue.properties) {
              // why: type guard for jsonc-eslint-parser
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
