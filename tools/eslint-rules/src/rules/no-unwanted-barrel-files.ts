import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, relative, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { findProjectRoot, isPublishableLibrary, parseJsonFile } from '../utils/nx-project'

/**
 * Rule identifier for the no-unwanted-barrel-files rule.
 */
export const RULE_NAME = 'no-unwanted-barrel-files'

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
 * Extracts allowed index.ts paths from package.json exports.
 *
 * @param projectRoot - The root directory of the project.
 * @param packageJson - The parsed package.json content.
 * @returns An array of allowed index.ts file paths.
 */
function getAllowedIndexPaths(projectRoot: string, packageJson: PackageJson): string[] {
  const allowed: string[] = []

  allowed.push(join(projectRoot, 'src', 'index.ts'))

  if (packageJson.exports) {
    for (const exportValue of Object.values(packageJson.exports)) {
      const resolvedPath = resolveExportValue(exportValue)
      if (resolvedPath) {
        const sourcePath = resolvedPath.replace(/^\.\//, '').replace(/\.(js|cjs|mjs)$/, '.ts')
        allowed.push(join(projectRoot, sourcePath))
      }
    }
  }

  return allowed
}

/**
 * Builds the error detail message for the rule violation.
 *
 * @param packageJson - The parsed package.json content.
 * @returns The formatted error details string.
 */
function buildErrorDetails(packageJson: PackageJson): string {
  if (packageJson.exports && Object.keys(packageJson.exports).length > 0) {
    const exportsList = Object.entries(packageJson.exports)
      .map(([key, value]) => {
        const resolvedPath = resolveExportValue(value)
        const displayPath = resolvedPath ? resolvedPath.replace(/\.js$/, '.ts') : String(value)
        return `  "${key}" → ${displayPath}`
      })
      .join('\n')
    return `Allowed entry points based on package.json exports:\n${exportsList}`
  }
  return 'This library has no "exports" field in package.json, ' + 'so only the main entry point (src/index.ts) is allowed.'
}

/**
 * Creates the no-unwanted-barrel-files ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow barrel files (index.ts) that are not declared as entry points',
    },
    schema: [],
    messages: {
      unwantedBarrelFile:
        'Unexpected barrel file: "{{relativePath}}".\n' +
        'This library only allows index.ts files for declared entry points.\n\n' +
        '{{details}}\n\n' +
        'To fix: Either delete this barrel file (and update imports to reference ' +
        'implementation files directly), or add a corresponding export to package.json.',
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
    const packageJson = parseJsonFile<PackageJson>(packageJsonPath)

    if (!packageJson) {
      return {}
    }

    const allowedPaths = getAllowedIndexPaths(projectRoot, packageJson)
    const normalizedFilename = resolve(filename)

    const isAllowed = allowedPaths.some((allowed) => resolve(allowed) === normalizedFilename)

    if (isAllowed) {
      return {}
    }

    const relativePath = relative(projectRoot, filename)
    const details = buildErrorDetails(packageJson)

    return {
      Program(node: TSESTree.Program) {
        context.report({
          node,
          messageId: 'unwantedBarrelFile',
          data: {
            relativePath,
            details,
          },
        })
      },
    }
  },
})

export default rule
