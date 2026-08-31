import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readJsonFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-pkg-main-reexports rule.
 */
export const RULE_NAME = 'lib-pkg-main-reexports'

/**
 * API topology modes for configuring re-export requirements.
 *
 * - **barrel**: Main entry point (`.`) must re-export from all secondary entry points.
 *   Secondary entry points are for tree-shaking; main is the complete API.
 *
 * - **isomorphic**: No main `.` entry; platform-specific entries (`./browser`, `./node`)
 *   act as parallel mains. Optionally validates API parity between specified mains.
 *
 * - **fragmented**: Entry points are independent modules with no re-export expectation.
 *   Use for packages where each entry point is a distinct API surface.
 */
export type ApiTopology = 'barrel' | 'isomorphic' | 'fragmented'

/**
 * Rule options schema.
 */
export interface RuleOptions {
  /**
   * API topology mode. Determines how the rule validates re-exports.
   *
   * @default 'barrel'
   */
  topology?: ApiTopology

  /**
   * Entry points to exclude from validation.
   * Always excludes `./package.json` automatically.
   *
   * @example ['./internal', './testing']
   */
  exclude?: string[]

  /**
   * For isomorphic topology: entry points to treat as parallel main entry points.
   * Use to specify which entries should export the same API.
   *
   * @example ['./browser', './node']
   */
  mainEntryPoints?: string[]
}

const DEFAULT_OPTIONS: RuleOptions = {
  topology: 'barrel',
  exclude: [],
  mainEntryPoints: ['./browser', './node'],
}

/**
 * Entry points to always exclude from validation.
 */
const ALWAYS_EXCLUDED = ['./package.json']

/**
 * Normalizes an export key to a relative path suitable for comparison.
 * Handles both '.' and './subpath' formats.
 *
 * @param exportKey - The export key from package.json (e.g., '.', './actions').
 * @returns Normalized path without leading './' for comparison.
 */
function normalizeExportKey(exportKey: string): string {
  if (exportKey === '.') return ''
  return exportKey.startsWith('./') ? exportKey.slice(2) : exportKey
}

/**
 * Extracts the top-level directory from a path.
 * For nested paths like './changelog/parse', returns 'changelog'.
 *
 * @param exportKey - The export key from package.json.
 * @returns The top-level directory name, or empty string for main entry.
 */
function getTopLevelDir(exportKey: string): string {
  const normalized = normalizeExportKey(exportKey)
  if (!normalized) return ''
  const firstSlash = normalized.indexOf('/')
  return firstSlash > -1 ? normalized.slice(0, firstSlash) : normalized
}

/**
 * Checks if an entry point should be excluded from validation.
 *
 * @param exportKey - The export key to check.
 * @param excludePatterns - User-configured exclusion patterns.
 * @returns True if the entry should be excluded.
 */
function shouldExclude(exportKey: string, excludePatterns: string[]): boolean {
  if (ALWAYS_EXCLUDED.includes(exportKey)) return true
  if (excludePatterns.includes(exportKey)) return true
  return false
}

/**
 * Resolves export value to a source path.
 * Handles both string exports and conditional export objects.
 *
 * @param exportValue - The export value from package.json.
 * @returns The resolved source path, or null if not resolvable.
 */
function resolveExportPath(exportValue: string | Record<string, string>): string | null {
  if (typeof exportValue === 'string') return exportValue
  if (typeof exportValue === 'object' && exportValue !== null) {
    return exportValue['import'] ?? exportValue['require'] ?? exportValue['default'] ?? null
  }
  // why: unreachable: type guards above cover all cases
  return null
}

/**
 * Determines expected re-export directories for barrel topology.
 * Groups nested exports by top-level directory to find which directories
 * the main entry should re-export from.
 *
 * @param exports - The exports field from package.json.
 * @param excludePatterns - Patterns to exclude from validation.
 * @returns Array of unique top-level directories that should be re-exported.
 */
function getExpectedReexportDirs(exports: Record<string, string | Record<string, string>>, excludePatterns: string[]): string[] {
  const dirs = createSet<string>()

  for (const key of keys(exports)) {
    if (key === '.') continue
    if (shouldExclude(key, excludePatterns)) continue

    const topLevel = getTopLevelDir(key)
    if (topLevel) {
      dirs.add(topLevel)
    }
  }

  return [...dirs].sort()
}

/**
 * Checks if a file is the main entry point for a package.
 *
 * @param filename - The file being linted.
 * @param projectRoot - The project root directory.
 * @param exports - The exports field from package.json.
 * @returns True if the file is the main entry point.
 */
function isMainEntryPoint(filename: string, projectRoot: string, exports: Record<string, string | Record<string, string>>): boolean {
  const mainExport = exports['.']
  if (!mainExport) return false

  const mainPath = resolveExportPath(mainExport)
  if (!mainPath) return false

  const sourcePath = mainPath.replace(/^\.\//, '').replace(/\.(m?js|cjs)$/, '.ts')
  const expectedPath = resolve(projectRoot, sourcePath)

  return resolve(filename) === expectedPath
}

/**
 * Creates the lib-pkg-main-reexports ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Require main entry point to re-export all secondary entry points for barrel topology libraries',
    },
    schema: [
      {
        type: 'object',
        properties: {
          topology: {
            type: 'string',
            enum: ['barrel', 'isomorphic', 'fragmented'],
            description: 'API topology mode for configuring re-export requirements',
          },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entry points to exclude from validation',
          },
          mainEntryPoints: {
            type: 'array',
            items: { type: 'string' },
            description: 'For isomorphic topology: parallel main entry points',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingReexport:
        "Main entry point is missing re-export for '{{directory}}'. " +
        "Add 'export * from './{{directory}}'' to re-export all secondary entry point APIs.",
      noMainEntryPoint:
        "Package has barrel topology but no main entry point ('.'). " +
        'Either add a main entry point that re-exports secondary entries, ' +
        "or configure topology as 'isomorphic' or 'fragmented'.",
    },
  },
  defaultOptions: [DEFAULT_OPTIONS],
  create(context, [userOptions]) {
    const filename = context.filename
    const options = { ...DEFAULT_OPTIONS, ...userOptions }

    if (options.topology !== 'barrel') {
      return {}
    }

    const fileDir = dirname(filename)
    const projectRoot = findProjectRoot(fileDir)

    if (!projectRoot || !isPublishableLibrary(projectRoot)) {
      return {}
    }

    const packageJsonPath = join(projectRoot, 'package.json')
    const packageJson = readJsonFileIfExists<PackageJson>(packageJsonPath)

    if (!packageJson?.exports || typeof packageJson.exports !== 'object') {
      return {}
    }

    const exports = packageJson.exports as Record<string, string | Record<string, string>>

    if (!isMainEntryPoint(filename, projectRoot, exports)) {
      return {}
    }

    const expectedDirs = getExpectedReexportDirs(exports, options.exclude ?? [])

    if (expectedDirs.length === 0) {
      return {}
    }

    const foundReexports = createSet<string>()

    return {
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        if (node.source && typeof node.source.value === 'string') {
          const source = node.source.value
          if (source.startsWith('./')) {
            const dir = source.slice(2).split('/')[0]
            if (dir) {
              foundReexports.add(dir)
            }
          }
        }
      },

      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        if (node.source && typeof node.source.value === 'string') {
          const source = node.source.value
          if (source.startsWith('./')) {
            const dir = source.slice(2).split('/')[0]
            if (dir) {
              foundReexports.add(dir)
            }
          }
        }
      },

      'Program:exit'(node: TSESTree.Program) {
        for (const dir of expectedDirs) {
          if (!foundReexports.has(dir)) {
            context.report({
              node,
              messageId: 'missingReexport',
              data: { directory: dir },
            })
          }
        }
      },
    }
  },
})

export default rule
