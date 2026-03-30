import type { TSESTree } from '@typescript-eslint/utils'
import { dirname, join, resolve } from 'node:path'
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, findTypeScriptWorkspaceRoot, readFileContent, readJsonFileIfExists } from '../utils'

/**
 * Rule identifier for the deepest-import-path rule.
 */
export const RULE_NAME = 'deepest-import-path'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'useDeeperImport'

/**
 * Represents a parsed tsconfig.json structure.
 */
interface TsConfig {
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
  }
}

/**
 * Represents the export mapping for a package.
 * Maps export name to the deepest path that exports it.
 */
interface ExportMapping {
  /** The deepest path that exports this symbol. */
  deepestPath: string
}

/**
 * Cache for parsed tsconfig paths.
 */
let cachedPaths: Map<string, string> | null = null
let cachedWorkspaceRoot: string | null = null

/**
 * Cache for export analysis results.
 * Key: source file path, Value: Map of export name to deepest path.
 */
const exportCache = createMap<string, Map<string, ExportMapping>>()

/**
 * Gets the tsconfig paths for packages matching the given prefix.
 *
 * @param workspaceRoot - The workspace root directory.
 * @param packagePrefix - The package prefix to filter (default: `@hyperfrontend/`).
 * @returns Map of path alias to resolved source file path.
 */
function getTsconfigPaths(workspaceRoot: string, packagePrefix: string): Map<string, string> {
  /* istanbul ignore if -- cache hit is performance optimization, tested via behavior */
  if (cachedPaths !== null && cachedWorkspaceRoot === workspaceRoot) {
    return cachedPaths
  }

  const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json')
  const tsconfig = readJsonFileIfExists<TsConfig>(tsconfigPath)

  /* istanbul ignore if -- defensive for malformed tsconfig */
  if (!tsconfig?.compilerOptions?.paths) {
    cachedPaths = createMap()
    cachedWorkspaceRoot = workspaceRoot
    return cachedPaths
  }

  const paths = createMap<string, string>()
  const baseUrl = tsconfig.compilerOptions.baseUrl ?? '.'

  for (const [alias, targets] of entries(tsconfig.compilerOptions.paths)) {
    if (!alias.startsWith(packagePrefix)) {
      continue
    }

    const target = targets[0]
    /* istanbul ignore if -- defensive for empty paths array */
    if (!target) {
      continue
    }

    const resolvedPath = resolve(workspaceRoot, baseUrl, target)
    paths.set(alias, resolvedPath)
  }

  cachedPaths = paths
  cachedWorkspaceRoot = workspaceRoot
  return paths
}

/**
 * Resolves a relative import path to an absolute file path.
 *
 * @param importPath - The relative import path (e.g., './module').
 * @param fromFile - The file containing the import.
 * @returns The resolved absolute file path, or null if not found.
 */
function resolveImportPath(importPath: string, fromFile: string): string | null {
  const dir = dirname(fromFile)
  const basePath = resolve(dir, importPath)

  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']
  for (const ext of extensions) {
    const fullPath = basePath + ext
    if (exists(fullPath)) {
      return fullPath
    }
  }

  if (exists(basePath)) {
    return basePath
  }

  return null
}

/**
 * Parses a TypeScript/JavaScript file to extract its named exports.
 * Follows barrel re-exports (`export * from`) recursively.
 *
 * @param filePath - The path to the source file.
 * @param visited - Set of already visited files to prevent circular dependencies.
 * @returns Set of exported names from this file.
 */
function parseExports(filePath: string, visited: Set<string> = createSet()): Set<string> {
  const exports = createSet<string>()

  if (!exists(filePath) || visited.has(filePath)) {
    return exports
  }
  visited.add(filePath)

  try {
    const content = readFileContent(filePath)

    const namedExportRegex = /export\s*\{([^}]+)\}/g
    let match: RegExpExecArray | null
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1]
      /* istanbul ignore if -- defensive for malformed export */
      if (!names) continue
      for (const name of names.split(',')) {
        const trimmed = name.trim()
        const parts = trimmed.split(/\s+as\s+/)
        const exportName = (parts[1] ?? parts[0] ?? '').replace(/^type\s+/, '').trim()
        if (exportName) {
          exports.add(exportName)
        }
      }
    }

    const declarationExportRegex = /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g
    while ((match = declarationExportRegex.exec(content)) !== null) {
      const name = match[1]
      /* istanbul ignore else -- match[1] always exists when regex matches */
      if (name) {
        exports.add(name)
      }
    }

    const typeExportRegex = /export\s+type\s*\{([^}]+)\}/g
    while ((match = typeExportRegex.exec(content)) !== null) {
      const names = match[1]
      /* istanbul ignore if -- defensive for malformed export */
      if (!names) continue
      for (const name of names.split(',')) {
        const trimmed = name.trim()
        const parts = trimmed.split(/\s+as\s+/)
        const exportName = (parts[1] ?? parts[0] ?? '').trim()
        if (exportName) {
          exports.add(exportName)
        }
      }
    }

    const barrelExportRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g
    while ((match = barrelExportRegex.exec(content)) !== null) {
      const importPath = match[1]
      /* istanbul ignore if -- defensive for malformed re-export */
      if (!importPath) continue

      const resolvedPath = resolveImportPath(importPath, filePath)
      if (resolvedPath) {
        const reExports = parseExports(resolvedPath, visited)
        for (const name of reExports) {
          exports.add(name)
        }
      }
    }

    return exports
  } catch {
    /* istanbul ignore next -- defensive for read errors */
    return exports
  }
}

/**
 * Finds all subpaths for a given package.
 *
 * @param packageName - The base package name (e.g., '@hyperfrontend/project-scope').
 * @param tsconfigPaths - Map of all available path aliases.
 * @returns Array of subpath entries sorted by depth (deepest first).
 */
function getPackageSubpaths(packageName: string, tsconfigPaths: Map<string, string>): Array<{ alias: string; sourcePath: string }> {
  const subpaths: Array<{ alias: string; sourcePath: string; depth: number }> = []

  for (const [alias, sourcePath] of tsconfigPaths) {
    if (alias === packageName || alias.startsWith(`${packageName}/`)) {
      const depth = alias.split('/').length
      subpaths.push({ alias, sourcePath, depth })
    }
  }

  subpaths.sort((a, b) => b.depth - a.depth)

  return subpaths.map(({ alias, sourcePath }) => ({ alias, sourcePath }))
}

/**
 * Determines if all symbols can be imported from a common deeper path.
 *
 * @param symbols - Array of symbol names being imported.
 * @param packageName - The base package name.
 * @param tsconfigPaths - Map of all available path aliases.
 * @returns The common deeper path if all symbols share one, null otherwise.
 */
function findCommonDeeperPath(symbols: string[], packageName: string, tsconfigPaths: Map<string, string>): string | null {
  if (symbols.length === 0) {
    return null
  }

  const subpaths = getPackageSubpaths(packageName, tsconfigPaths)

  for (const { alias, sourcePath } of subpaths) {
    if (alias === packageName) {
      continue
    }

    const exports = parseExports(sourcePath)
    const allSymbolsExported = symbols.every((symbol) => exports.has(symbol))

    if (allSymbolsExported) {
      return alias
    }
  }

  return null
}

/**
 * Extracts symbol names from import specifiers.
 *
 * @param specifiers - The import specifiers from an import declaration.
 * @returns Array of imported symbol names (using imported name, not local alias).
 */
function extractImportedSymbols(specifiers: TSESTree.ImportClause[]): string[] {
  const symbols: string[] = []

  for (const specifier of specifiers) {
    if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
      /* istanbul ignore else -- Literal imports are rare ES2022 syntax */
      if (specifier.imported.type === AST_NODE_TYPES.Identifier) {
        symbols.push(specifier.imported.name)
      }
    }
  }

  return symbols
}

/**
 * Extracts the base package name from an import path.
 *
 * @param importPath - The full import path (e.g., '@hyperfrontend/project-scope/cli').
 * @returns The base package name (e.g., '@hyperfrontend/project-scope').
 */
function getBasePackageName(importPath: string): string {
  const parts = importPath.split('/')

  /* istanbul ignore else -- always scoped for @hyperfrontend */
  if (parts[0]?.startsWith('@') && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`
  }

  /* istanbul ignore next -- empty path fallback is defensive */
  return parts[0] ?? importPath
}

/**
 * Options for the deepest-import-path rule.
 */
interface RuleOptions {
  /**
   * The package prefix to check (e.g., '@hyperfrontend/').
   * Only imports starting with this prefix will be analyzed.
   *
   * @default '@hyperfrontend/'
   */
  packagePrefix?: string
}

export default createRule<[RuleOptions?], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require imports to use the deepest available package subpath',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          packagePrefix: {
            type: 'string',
            description: "The package prefix to check (e.g., '@hyperfrontend/'). Only imports starting with this prefix will be analyzed.",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      useDeeperImport: "Import from '{{ currentPath }}' could use a more specific path: '{{ suggestedPath }}'.",
    },
  },
  defaultOptions: [{ packagePrefix: '@hyperfrontend/' }],
  create(context, [options]) {
    const packagePrefix = options?.packagePrefix ?? '@hyperfrontend/'
    const filename = context.filename
    const workspaceRoot = findTypeScriptWorkspaceRoot(dirname(filename))

    /* istanbul ignore if -- defensive if workspace root not found */
    if (!workspaceRoot) {
      return {}
    }

    const tsconfigPaths = getTsconfigPaths(workspaceRoot, packagePrefix)

    /* istanbul ignore if -- no paths means nothing to check */
    if (tsconfigPaths.size === 0) {
      return {}
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value

        if (typeof source !== 'string' || !source.startsWith(packagePrefix)) {
          return
        }

        const basePackage = getBasePackageName(source)

        // Only suggest when importing from base package (conservative approach)
        if (source !== basePackage) {
          return
        }

        const symbols = extractImportedSymbols(node.specifiers)

        if (symbols.length === 0) {
          return
        }

        const deeperPath = findCommonDeeperPath(symbols, basePackage, tsconfigPaths)

        if (deeperPath) {
          const sourceCode = context.sourceCode

          context.report({
            node: node.source,
            messageId: 'useDeeperImport',
            data: {
              currentPath: source,
              suggestedPath: deeperPath,
            },
            fix(fixer) {
              const rawSource = sourceCode.getText(node.source)
              const quoteChar = rawSource.charAt(0)

              return fixer.replaceText(node.source, `${quoteChar}${deeperPath}${quoteChar}`)
            },
          })
        }
      },
    }
  },
})

/**
 * Clears the cached paths (useful for testing).
 */
export function clearCache(): void {
  cachedPaths = null
  cachedWorkspaceRoot = null
  exportCache.clear()
}
