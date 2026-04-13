import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the no-barrel-star-export rule.
 */
export const RULE_NAME = 'no-barrel-star-export'

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

  /* istanbul ignore next -- unreachable given TypeScript types, defensive fallback for malformed JSON */
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
 * Creates the no-barrel-star-export ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `export * from` in entry point barrel files',
    },
    schema: [],
    messages: {
      noStarExport:
        'Star exports (`export * from "{{source}}"`) are not allowed in entry point files. ' +
        'Use explicit named exports instead: `export { name1, name2 } from "{{source}}"`.',
      noStarExportTypeOnly:
        'Star type exports (`export type * from "{{source}}"`) are not allowed in entry point files. ' +
        'Use explicit named exports instead: `export type { Type1, Type2 } from "{{source}}"`.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename

    /* istanbul ignore next -- Windows path separator only testable on Windows */
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
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        const source = node.source.value

        context.report({
          node,
          messageId: node.exportKind === 'type' ? 'noStarExportTypeOnly' : 'noStarExport',
          data: {
            source,
          },
        })
      },
    }
  },
})

export default rule
