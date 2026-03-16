import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import type { PackageJson, ProjectJson } from '../utils/nx-project'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * Rule identifier for the lib-tsconfig-paths rule.
 */
export const RULE_NAME = 'lib-tsconfig-paths'

/**
 * Represents a library entry point mapping.
 */
interface EntryPointMapping {
  /**
   * The tsconfig path alias (e.g., "@hyperfrontend/project-scope/cli").
   */
  pathAlias: string
  /**
   * The relative source file path (e.g., "libs/project-scope/src/cli/index.ts").
   */
  sourcePath: string
  /**
   * The package name this entry point belongs to.
   */
  packageName: string
  /**
   * The export key from package.json (e.g., "." or "./cli").
   */
  exportKey: string
}

/**
 * Parses a JSON file safely.
 *
 * @param filePath - The path to the JSON file.
 * @returns The parsed JSON object, or null if parsing fails.
 */
function parseJsonFile<T>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return <T>JSON.parse(content)
    /* istanbul ignore next -- defensive error handling for malformed JSON */
  } catch {
    return null
  }
}

/**
 * Checks if a project is a library by examining its project.json.
 *
 * @param projectDir - The project directory path.
 * @returns True if the project is a library.
 */
function isLibrary(projectDir: string): boolean {
  const projectJsonPath = join(projectDir, 'project.json')
  const projectJson = parseJsonFile<ProjectJson>(projectJsonPath)

  /* istanbul ignore if -- defensive for malformed project.json */
  if (!projectJson) {
    return false
  }

  return projectJson.projectType === 'library'
}

/**
 * Recursively finds all library directories in the workspace.
 *
 * @param dir - The directory to search in.
 * @param workspaceRoot - The workspace root directory.
 * @returns Array of library directory paths.
 */
function findLibraryDirectories(dir: string, workspaceRoot: string): string[] {
  const results: string[] = []

  if (!existsSync(dir)) {
    return results
  }

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    // Skip node_modules, hidden directories, and common non-project directories
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
      continue
    }

    const fullPath = join(dir, entry.name)

    // Check if this directory is a library
    if (isLibrary(fullPath)) {
      results.push(fullPath)
    }

    // Recurse into subdirectories
    results.push(...findLibraryDirectories(fullPath, workspaceRoot))
  }

  return results
}

/**
 * Converts a package.json export path (./sub/path.js) to a TypeScript source path.
 *
 * @param exportPath - The export path from package.json.
 * @param projectDir - The project directory.
 * @param workspaceRoot - The workspace root directory.
 * @returns The relative source path from workspace root, or null if not found.
 */
function resolveExportToSourcePath(exportPath: string, projectDir: string, workspaceRoot: string): string | null {
  // Remove leading ./ -- istanbul ignore next is for the else branch where path doesn't start with ./
  /* istanbul ignore next -- exports conventionally start with ./, unlikely to hit else */
  let normalizedPath = exportPath.startsWith('./') ? exportPath.slice(2) : exportPath

  // Convert .js/.mjs/.cjs to .ts
  normalizedPath = normalizedPath.replace(/\.(m?js|cjs)$/, '.ts')

  const absolutePath = join(projectDir, normalizedPath)

  // Check if the TypeScript file exists
  if (existsSync(absolutePath)) {
    return relative(workspaceRoot, absolutePath)
  }

  // Also try .mts and .cts if the original was .mjs/.cjs
  const mtsPath = absolutePath.replace(/\.ts$/, '.mts')
  const ctsPath = absolutePath.replace(/\.ts$/, '.cts')

  /* istanbul ignore if -- mts fallback tested via dedicated test */
  if (existsSync(mtsPath)) {
    return relative(workspaceRoot, mtsPath)
  }
  /* istanbul ignore if -- cts fallback tested via dedicated test */
  if (existsSync(ctsPath)) {
    return relative(workspaceRoot, ctsPath)
  }

  return null
}

/**
 * Gets all entry point mappings for a library.
 *
 * @param projectDir - The library project directory.
 * @param workspaceRoot - The workspace root directory.
 * @returns Array of entry point mappings.
 */
function getLibraryEntryPoints(projectDir: string, workspaceRoot: string): EntryPointMapping[] {
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJson = parseJsonFile<PackageJson>(packageJsonPath)

  if (!packageJson?.name || !packageJson.exports) {
    return []
  }

  const mappings: EntryPointMapping[] = []
  const packageName = packageJson.name

  for (const [exportKey, exportValue] of Object.entries(packageJson.exports)) {
    // Skip package.json self-references
    /* istanbul ignore if -- tested in separate case */
    if (exportKey === './package.json' || exportValue === './package.json') {
      continue
    }

    // Handle conditional exports (object with import/require keys)
    let exportPath: string | null = null
    if (typeof exportValue === 'string') {
      exportPath = exportValue
      /* istanbul ignore else -- conditional exports tested separately */
    } else if (typeof exportValue === 'object' && exportValue !== null) {
      // Use 'import' or 'default' or first available path
      exportPath = exportValue['import'] ?? exportValue['default'] ?? Object.values(exportValue)[0]
    }

    /* istanbul ignore if -- defensive for invalid export types */
    if (!exportPath || typeof exportPath !== 'string') {
      continue
    }

    const sourcePath = resolveExportToSourcePath(exportPath, projectDir, workspaceRoot)

    if (!sourcePath) {
      // Source file doesn't exist, skip silently (other rules handle missing files)
      continue
    }

    // Build the path alias
    // Export "." → package name (e.g., "@hyperfrontend/project-scope")
    // Export "./sub" → package name + sub (e.g., "@hyperfrontend/project-scope/sub")
    let pathAlias: string
    if (exportKey === '.') {
      pathAlias = packageName
    } else {
      // Remove leading ./ from export key
      const subPath = exportKey.startsWith('./') ? exportKey.slice(2) : exportKey
      pathAlias = `${packageName}/${subPath}`
    }

    mappings.push({
      pathAlias,
      sourcePath,
      packageName,
      exportKey,
    })
  }

  return mappings
}

/**
 * Extracts existing path mappings from the tsconfig AST.
 *
 * @param pathsNode - The paths property AST node.
 * @returns Map of path alias to source paths array.
 */
function extractExistingPaths(pathsNode: JSONNode): Map<string, string[]> {
  const paths = new Map<string, string[]>()

  /* istanbul ignore if -- defensive type guard for jsonc-eslint-parser */
  if (pathsNode.type !== 'JSONObjectExpression') {
    return paths
  }

  for (const prop of pathsNode.properties) {
    /* istanbul ignore if -- defensive type guard for jsonc-eslint-parser */
    if (prop.type !== 'JSONProperty') {
      continue
    }

    const key = prop.key
    let keyName: string | null = null

    if (key.type === 'JSONIdentifier') {
      keyName = key.name
    } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
      keyName = key.value
    }

    /* istanbul ignore if -- defensive for malformed JSON keys */
    if (!keyName) {
      continue
    }

    const value = prop.value
    if (value.type === 'JSONArrayExpression') {
      const sourcePaths: string[] = []
      for (const element of value.elements) {
        if (element && element.type === 'JSONLiteral' && typeof element.value === 'string') {
          sourcePaths.push(element.value)
        }
      }
      paths.set(keyName, sourcePaths)
    }
  }

  return paths
}

/**
 * Options for the lib-tsconfig-paths rule.
 */
interface RuleOptions {
  /**
   * Directories to scan for library-type projects (relative to workspace root).
   * Each directory will be recursively searched for projects with projectType: "library".
   *
   * @example ["libs", "plugins", "tools"]
   */
  libraryDirectories: string[]
  /**
   * Directory path segments to exclude from scanning.
   * Any path containing one of these segments will be skipped.
   *
   * @example ["__fixtures__", "node_modules"]
   */
  excludePatterns?: string[]
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require that library entry points are mapped in tsconfig.base.json paths',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-tsconfig-paths.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          libraryDirectories: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description:
              'Directories to scan for library-type projects (relative to workspace root). Each directory is recursively searched for projects with projectType: "library".',
          },
          excludePatterns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Directory path segments to exclude from scanning. Any path containing one of these segments will be skipped (e.g., "__fixtures__", "node_modules").',
          },
        },
        required: ['libraryDirectories'],
        additionalProperties: false,
      },
    ],
    messages: {
      missingPathMapping:
        "Library '{{ packageName }}' export '{{ exportKey }}' is missing from tsconfig.base.json paths. Expected path alias '{{ pathAlias }}' → '{{ sourcePath }}'.",
      pathsNotOrganized: 'Path mappings for {{ packageName }} are not co-located. Reorganize paths to group them by package.',
      orphanPathMapping:
        "Path mapping '{{ pathAlias }}' points to a file that does not exist: '{{ sourcePath }}'. Remove this stale mapping.",
      unknownPackageMapping:
        "Path mapping '{{ pathAlias }}' does not match any library and the file does not exist: '{{ sourcePath }}'. Remove this stale mapping.",
    },
  },

  create(context) {
    const filePath = context.filename

    // Only run on tsconfig.base.json at the workspace root
    const fileName = filePath.split('/').pop()
    if (fileName !== 'tsconfig.base.json') {
      return {}
    }

    const workspaceRoot = dirname(filePath)

    // Get rule options - libraryDirectories is required by schema
    const options = context.options[0] as RuleOptions | undefined

    // If no options provided, skip (schema validation will catch this)
    if (!options?.libraryDirectories?.length) {
      return {}
    }

    const { libraryDirectories, excludePatterns = [] } = options

    /**
     * Checks if a directory path should be excluded based on exclude patterns.
     * Uses simple segment matching - if any segment in the path matches an exclude pattern, the path is excluded.
     *
     * @param relativePath - The path relative to workspace root.
     * @returns True if the path should be excluded, false otherwise.
     */
    const isExcludedPath = (relativePath: string): boolean => {
      const pathSegments = relativePath.split('/')
      for (const pattern of excludePatterns) {
        if (pathSegments.includes(pattern)) {
          return true
        }
      }
      return false
    }

    // Find all libraries across configured directories
    const libraryDirs: string[] = []
    for (const dir of libraryDirectories) {
      const absoluteDir = join(workspaceRoot, dir)
      const foundDirs = findLibraryDirectories(absoluteDir, workspaceRoot)

      // Filter out excluded directories
      for (const foundDir of foundDirs) {
        const relativePath = relative(workspaceRoot, foundDir)
        if (!isExcludedPath(relativePath)) {
          libraryDirs.push(foundDir)
        }
      }
    }

    // Collect all expected entry point mappings
    const expectedMappings: EntryPointMapping[] = []
    for (const libDir of libraryDirs) {
      expectedMappings.push(...getLibraryEntryPoints(libDir, workspaceRoot))
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

        // We're looking for compilerOptions.paths
        if (keyName !== 'paths') {
          return
        }

        // Verify we're inside compilerOptions
        const parent = (node as JSONNode & { parent?: JSONNode }).parent
        if (parent?.type === 'JSONObjectExpression') {
          const grandparent = (parent as JSONNode & { parent?: JSONNode }).parent
          if (grandparent?.type === 'JSONProperty') {
            const gpKey = grandparent.key
            let gpKeyName: string | null = null
            if (gpKey.type === 'JSONIdentifier') {
              gpKeyName = gpKey.name
            } else if (gpKey.type === 'JSONLiteral' && typeof gpKey.value === 'string') {
              gpKeyName = gpKey.value
            }
            if (gpKeyName !== 'compilerOptions') {
              return
            }
          }
        }

        const pathsValue = node.value
        if (pathsValue.type !== 'JSONObjectExpression') {
          return
        }

        const existingPaths = extractExistingPaths(pathsValue)
        const existingPathsList = Array.from(existingPaths.keys())

        // Build a map of package names to their paths
        const packageNameSet = new Set(expectedMappings.map((m) => m.packageName))

        // Check for orphan paths (paths that point to non-existent files or don't match any package)
        const orphanPaths: Array<{ pathAlias: string; sourcePath: string; propertyNode: JSONNode; reason: 'nonexistent' | 'unknown' }> = []

        for (const prop of pathsValue.properties) {
          /* istanbul ignore if -- defensive type guard for jsonc-eslint-parser */
          if (prop.type !== 'JSONProperty') {
            continue
          }

          const key = prop.key
          let keyName: string | null = null

          if (key.type === 'JSONIdentifier') {
            keyName = key.name
          } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
            keyName = key.value
          }

          /* istanbul ignore if -- defensive for malformed JSON keys */
          if (!keyName) {
            continue
          }

          // Get source paths for this alias
          const sourcePaths = existingPaths.get(keyName) ?? []
          const sourcePath = sourcePaths[0] ?? ''

          // Check if the source file exists
          let fileExists = false
          if (sourcePath) {
            const absolutePath = join(workspaceRoot, sourcePath)
            fileExists = existsSync(absolutePath)
          }

          // Check if this path belongs to a known package (one with exports in package.json)
          /* istanbul ignore next -- callback may not execute if packageNameSet is empty */
          const matchesKnownPackage = Array.from(packageNameSet).some((pkg) => keyName === pkg || keyName.startsWith(`${pkg}/`))

          if (!matchesKnownPackage) {
            // If the path doesn't match a known package but the file exists,
            // it's a valid manual mapping (e.g., Nx plugins that use generators/executors instead of exports)
            if (!fileExists) {
              orphanPaths.push({
                pathAlias: keyName,
                sourcePath,
                propertyNode: prop,
                reason: 'unknown',
              })
            }
            continue
          }

          // For known packages, verify the source file exists
          if (sourcePath && !fileExists) {
            orphanPaths.push({
              pathAlias: keyName,
              sourcePath,
              propertyNode: prop,
              reason: 'nonexistent',
            })
          }
        }

        // Report orphan paths with autofix to remove them
        for (const orphan of orphanPaths) {
          const messageId = orphan.reason === 'nonexistent' ? 'orphanPathMapping' : 'unknownPackageMapping'

          context.report({
            node: orphan.propertyNode as unknown as Rule.Node,
            messageId,
            data: {
              pathAlias: orphan.pathAlias,
              sourcePath: orphan.sourcePath,
            },
            fix(fixer) {
              const properties = pathsValue.properties
              const propIndex = properties.findIndex((p) => p === orphan.propertyNode)
              const propRange = orphan.propertyNode.range

              /* istanbul ignore if -- defensive for missing range */
              if (!propRange) {
                return null
              }

              const sourceCode = context.sourceCode
              const fullText = sourceCode.getText()

              // Determine the range to remove (including comma and whitespace)
              let startPos = propRange[0]
              let endPos = propRange[1]

              // Check for leading whitespace/newline
              let leadingStart = startPos
              while (leadingStart > 0 && (fullText[leadingStart - 1] === ' ' || fullText[leadingStart - 1] === '\n')) {
                leadingStart--
              }

              // Check for trailing comma
              const textAfter = fullText.slice(endPos, endPos + 20)
              const commaMatch = textAfter.match(/^\s*,/)
              if (commaMatch) {
                endPos += commaMatch[0].length
                /* istanbul ignore else -- edge case when orphan is last property and not first */
              } else if (propIndex > 0) {
                // If no trailing comma and not first, remove leading comma instead
                const textBefore = fullText.slice(leadingStart - 10, leadingStart)
                const leadingCommaMatch = textBefore.match(/,\s*$/)
                /* istanbul ignore if -- edge case for leading comma removal */
                if (leadingCommaMatch) {
                  leadingStart -= leadingCommaMatch[0].length
                }
              }

              // Include the leading newline/whitespace
              startPos = leadingStart

              return fixer.removeRange([startPos, endPos])
            },
          })
        }

        // Check for missing mappings
        const missingMappings: EntryPointMapping[] = []

        for (const mapping of expectedMappings) {
          if (!existingPaths.has(mapping.pathAlias)) {
            missingMappings.push(mapping)
          }
        }

        // Sort missing mappings to ensure proper hierarchical ordering
        missingMappings.sort(/* istanbul ignore next */ (a, b) => a.pathAlias.localeCompare(b.pathAlias))

        // Report missing mappings with a combined autofix on the first error
        // This ensures all missing mappings are fixed in a single pass
        for (let i = 0; i < missingMappings.length; i++) {
          const mapping = missingMappings[i]
          /* istanbul ignore if -- defensive for array access */
          if (!mapping) {
            continue
          }

          context.report({
            node: pathsValue as unknown as Rule.Node,
            messageId: 'missingPathMapping',
            data: {
              packageName: mapping.packageName,
              exportKey: mapping.exportKey,
              pathAlias: mapping.pathAlias,
              sourcePath: mapping.sourcePath,
            },
            // Only attach fix to the first error - it will add ALL missing mappings
            fix:
              i === 0
                ? (fixer) => {
                    // Build the complete new paths object with all existing + missing mappings
                    const allMappings: Array<{ pathAlias: string; sourcePaths: string[] }> = []

                    // Add existing paths (excluding orphans which will be removed by their own fix)
                    for (const [alias, sourcePaths] of existingPaths.entries()) {
                      /* istanbul ignore next -- callback may not execute if orphanPaths is empty */
                      if (!orphanPaths.some((o) => o.pathAlias === alias)) {
                        allMappings.push({ pathAlias: alias, sourcePaths })
                      }
                    }

                    // Add all missing mappings
                    for (const m of missingMappings) {
                      allMappings.push({ pathAlias: m.pathAlias, sourcePaths: [m.sourcePath] })
                    }

                    // Sort all mappings: by package name first, then by path alias for hierarchical grouping
                    allMappings.sort((a, b) => {
                      const getPackageName = (alias: string): string => {
                        for (const m of expectedMappings) {
                          if (alias === m.pathAlias || alias.startsWith(`${m.packageName}/`)) {
                            return m.packageName
                          }
                        }
                        /* istanbul ignore next -- fallback for unknown packages */
                        return alias
                      }

                      const pkgA = getPackageName(a.pathAlias)
                      const pkgB = getPackageName(b.pathAlias)

                      if (pkgA !== pkgB) {
                        return pkgA.localeCompare(pkgB)
                      }

                      return a.pathAlias.localeCompare(b.pathAlias)
                    })

                    // Generate the new paths object
                    const lines = allMappings.map((m, idx) => {
                      const isLast = idx === allMappings.length - 1
                      const sourcePathsStr = m.sourcePaths.map((p) => `"${p}"`).join(', ')
                      const comma = isLast ? '' : ','
                      return `      "${m.pathAlias}": [${sourcePathsStr}]${comma}`
                    })

                    const newPathsContent = `{\n${lines.join('\n')}\n    }`
                    return fixer.replaceText(pathsValue as unknown as Rule.Node, newPathsContent)
                  }
                : undefined,
          })
        }

        // Check for path organization (paths from same package should be co-located)
        // Skip this check if there are missing mappings - the combined fix already handles organization
        if (missingMappings.length > 0) {
          return
        }

        // Only check paths that aren't orphans
        /* istanbul ignore next -- callback may not execute if orphanPaths is empty */
        const nonOrphanPaths = existingPathsList.filter((p) => !orphanPaths.some((o) => o.pathAlias === p))

        const packageIndices = new Map<string, number[]>()

        for (let i = 0; i < nonOrphanPaths.length; i++) {
          const pathAlias = nonOrphanPaths[i]
          /* istanbul ignore if -- defensive for array access */
          if (pathAlias === undefined) {
            continue
          }
          // Extract package name (everything up to the last segment if secondary, or full if primary)
          for (const mapping of expectedMappings) {
            if (pathAlias === mapping.pathAlias || pathAlias.startsWith(`${mapping.packageName}/`)) {
              const indices = packageIndices.get(mapping.packageName) ?? []
              indices.push(i)
              packageIndices.set(mapping.packageName, indices)
              break
            }
          }
        }

        // Check if indices for each package are consecutive
        for (const [packageName, indices] of packageIndices.entries()) {
          if (indices.length <= 1) {
            continue
          }

          const isConsecutive = indices.every((idx, i) => {
            if (i === 0) {
              return true
            }
            const prevIdx = indices[i - 1]
            return prevIdx !== undefined && idx === prevIdx + 1
          })

          if (!isConsecutive) {
            context.report({
              node: pathsValue as unknown as Rule.Node,
              messageId: 'pathsNotOrganized',
              data: { packageName },
              fix(fixer) {
                // Reorganize all paths to be grouped by package, alphabetically sorted within each package
                const allMappings: Array<{ pathAlias: string; sourcePaths: string[] }> = []

                for (const prop of pathsValue.properties) {
                  /* istanbul ignore if -- defensive type guard for jsonc-eslint-parser */
                  if (prop.type !== 'JSONProperty') {
                    continue
                  }

                  const key = prop.key
                  let keyName: string | null = null

                  if (key.type === 'JSONIdentifier') {
                    keyName = key.name
                  } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
                    keyName = key.value
                  }

                  /* istanbul ignore if -- defensive for malformed JSON keys */
                  if (!keyName) {
                    continue
                  }

                  // Skip orphan paths - they will be removed by their own fix
                  if (orphanPaths.some((o) => o.pathAlias === keyName)) {
                    continue
                  }

                  const sourcePaths = existingPaths.get(keyName) ?? []
                  allMappings.push({ pathAlias: keyName, sourcePaths })
                }

                // Sort mappings: first by extracted package name, then by path alias
                allMappings.sort((a, b) => {
                  // Extract package name for sorting
                  const getPackageName = (alias: string): string => {
                    for (const mapping of expectedMappings) {
                      if (alias === mapping.pathAlias || alias.startsWith(`${mapping.packageName}/`)) {
                        return mapping.packageName
                      }
                    }
                    // Fallback: use the alias itself as package name
                    /* istanbul ignore next -- fallback for unknown packages */
                    return alias
                  }

                  const pkgA = getPackageName(a.pathAlias)
                  const pkgB = getPackageName(b.pathAlias)

                  if (pkgA !== pkgB) {
                    return pkgA.localeCompare(pkgB)
                  }

                  return a.pathAlias.localeCompare(b.pathAlias)
                })

                // Generate the new paths object
                const lines = allMappings.map((m, i) => {
                  const isLast = i === allMappings.length - 1
                  const sourcePathsStr = m.sourcePaths.map((p) => `"${p}"`).join(', ')
                  const comma = isLast ? '' : ','
                  return `      "${m.pathAlias}": [${sourcePathsStr}]${comma}`
                })

                const newPathsContent = `{\n${lines.join('\n')}\n    }`
                return fixer.replaceText(pathsValue as unknown as Rule.Node, newPathsContent)
              },
            })
            // Only report once per run - subsequent packages will be fixed by the same reorganization
            break
          }
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
