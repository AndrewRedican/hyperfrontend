import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-require-module-header rule.
 */
export const RULE_NAME = 'lib-require-module-header'

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

  /* istanbul ignore next -- defensive: unreachable for typed string | Record input */
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
 * The module tag to detect in JSDoc comments.
 */
const MODULE_TAG = '@module'

/**
 * Checks if a JSDoc comment contains a module tag.
 *
 * @param comment - The comment text to check.
 * @returns True if the comment contains a module tag.
 */
function hasModuleTag(comment: string): boolean {
  const lowerComment = comment.toLowerCase()
  const index = lowerComment.indexOf(MODULE_TAG)
  if (index === -1) return false

  const charAfter = comment[index + MODULE_TAG.length]
  return charAfter === undefined || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '\r'
}

/**
 * Creates the lib-require-module-header ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @module header comment at the top of entry point files in publishable libraries',
    },
    schema: [],
    messages: {
      missingModuleHeader:
        'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.',
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
        const comments = sourceCode.getAllComments()

        if (comments.length === 0) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        const firstComment = comments[0]

        /* istanbul ignore if -- defensive check: unreachable when comments.length > 0 */
        if (!firstComment) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (firstComment.type !== 'Block' || !firstComment.value.startsWith('*')) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (firstComment.loc.start.line !== 1) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (!hasModuleTag(firstComment.value)) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: firstComment.loc,
          })
        }
      },
    }
  },
})

export default rule
