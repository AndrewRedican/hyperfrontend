import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-entry-export-spacing rule.
 */
export const RULE_NAME = 'lib-entry-export-spacing'

/**
 * Resolves an export value to a source path.
 *
 * @param exportValue - The export value from package.json (string or object).
 * @returns The resolved source path, or null if not resolvable.
 */
function resolveExportValue(exportValue: string | Record<string, string>): string | null {
  if (typeof exportValue === 'string') {
    return exportValue
  }

  if (typeof exportValue === 'object' && exportValue !== null) {
    return exportValue['import'] ?? exportValue['require'] ?? exportValue['default'] ?? null
  }

  return null
}

/**
 * Extracts allowed entry point paths from package.json exports.
 *
 * @param projectRoot - The root directory of the project.
 * @param packageJson - The parsed package.json content.
 * @returns An array of entry point file paths.
 */
function getEntryPointPaths(projectRoot: string, packageJson: PackageJson): string[] {
  const entryPoints: string[] = []

  entryPoints.push(join(projectRoot, 'src', 'index.ts'))

  if (packageJson.exports) {
    for (const exportValue of values(packageJson.exports)) {
      const resolvedPath = resolveExportValue(exportValue)
      if (resolvedPath && !resolvedPath.endsWith('package.json')) {
        const sourcePath = resolvedPath.replace(/^\.\//, '').replace(/\.(js|cjs|mjs)$/, '.ts')
        entryPoints.push(join(projectRoot, sourcePath))
      }
    }
  }

  return entryPoints
}

/**
 * Checks if a node is an export statement.
 *
 * @param node - AST node to check.
 * @returns True if the node is any kind of export statement.
 */
function isExportStatement(node: TSESTree.Node): boolean {
  return node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration'
}

/**
 * Creates the lib-entry-export-spacing ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)({
  name: RULE_NAME,
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce no blank lines between exports in entry point files',
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      noBlankLinesBetweenExports:
        'No blank lines allowed between exports in entry point files. Remove the blank line(s) between these export statements.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename

    if (!filename.endsWith('/index.ts') && !filename.endsWith('\\index.ts')) {
      return {}
    }

    const fileDir = dirname(filename)
    const projectRoot = findProjectRoot(fileDir)

    if (!projectRoot || !isPublishableLibrary(projectRoot)) {
      return {}
    }

    const packageJsonPath = join(projectRoot, 'package.json')
    const packageJson = readJsonFileIfExists<PackageJson>(packageJsonPath)

    if (!packageJson) {
      return {}
    }

    const entryPointPaths = getEntryPointPaths(projectRoot, packageJson)
    const normalizedFilename = resolve(filename)

    const isEntryPoint = entryPointPaths.some((entryPath) => resolve(entryPath) === normalizedFilename)

    if (!isEntryPoint) {
      return {}
    }

    return {
      Program(node: TSESTree.Program) {
        const sourceCode = context.sourceCode
        const exportStatements = node.body.filter(isExportStatement)

        if (exportStatements.length <= 1) {
          return
        }

        for (let i = 0; i < exportStatements.length - 1; i++) {
          const currentExport = exportStatements[i]
          const nextExport = exportStatements[i + 1]

          /* istanbul ignore next -- defensive: loop bounds guarantee these exist */
          if (!currentExport || !nextExport) {
            continue
          }

          const currentEndLine = currentExport.loc.end.line
          const nextStartLine = nextExport.loc.start.line
          const blankLineCount = nextStartLine - currentEndLine - 1

          if (blankLineCount > 0) {
            const tokensBetween = sourceCode.getTokensBetween(currentExport, nextExport, {
              includeComments: true,
            })

            if (tokensBetween.length > 0) {
              continue
            }

            context.report({
              node: nextExport,
              messageId: 'noBlankLinesBetweenExports',
              fix(fixer) {
                const currentExportEndToken = sourceCode.getLastToken(currentExport)
                const nextExportStartToken = sourceCode.getFirstToken(nextExport)

                /* istanbul ignore if -- defensive: tokens always exist for valid export statements */
                if (!currentExportEndToken || !nextExportStartToken) {
                  return null
                }

                const rangeStart = currentExportEndToken.range[1]
                const rangeEnd = nextExportStartToken.range[0]

                return fixer.replaceTextRange([rangeStart, rangeEnd], '\n')
              },
            })
          }
        }
      },
    }
  },
})

export default rule
