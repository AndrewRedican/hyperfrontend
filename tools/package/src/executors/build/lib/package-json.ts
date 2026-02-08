/**
 * Package.json generation utilities for the build executor.
 *
 * Uses Nx devkit's readJsonFile and writeJsonFile for JSON operations.
 */
import { readJsonFile, writeJsonFile } from '@nx/devkit'
import { join } from 'node:path'
import type { EntryPointDiscovery } from './types'

/** Package.json type with standard fields */
interface PackageJson {
  name?: string
  version?: string
  main?: string
  module?: string
  types?: string
  exports?: Record<string, unknown>
  repository?: { type: string; url: string } | string
  bugs?: { url: string } | string
  homepage?: string
  author?: { name: string; email?: string; url?: string } | string
  funding?: { type: string; url: string } | string
  [key: string]: unknown
}

/** Fields to inherit from root package.json */
const INHERITABLE_FIELDS = ['repository', 'bugs', 'homepage', 'author'] as const

/** Export entry for package.json */
interface ExportEntry {
  types: string
  import: string
  require: string
}

/**
 * Reads and parses the source package.json using Nx devkit.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed package.json contents
 */
export function readProjectPackageJson(projectRoot: string): PackageJson {
  const pkgPath = join(projectRoot, 'package.json')
  return readJsonFile<PackageJson>(pkgPath)
}

/**
 * Reads and parses the root (workspace) package.json using Nx devkit.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Parsed package.json contents
 */
export function readRootPackageJson(workspaceRoot: string): PackageJson {
  const pkgPath = join(workspaceRoot, 'package.json')
  return readJsonFile<PackageJson>(pkgPath)
}

/**
 * Extracts inheritable fields from root package.json.
 * Fields are only included if they exist in the root package.json.
 *
 * @param rootPkg - Root package.json contents
 * @returns Object with inheritable fields
 */
function getInheritableFields(rootPkg: PackageJson): Partial<PackageJson> {
  const result: Partial<PackageJson> = {}
  for (const field of INHERITABLE_FIELDS) {
    if (rootPkg[field] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[field] = rootPkg[field]
    }
  }
  return result
}

/**
 * Writes package.json to the output directory using Nx devkit.
 *
 * @param outputPath - Absolute path to output directory
 * @param packageJson - Package.json contents to write
 */
export function writeOutputPackageJson(outputPath: string, packageJson: PackageJson): void {
  const pkgPath = join(outputPath, 'package.json')
  writeJsonFile(pkgPath, packageJson)
}

/**
 * Creates an export entry for a given output path.
 *
 * @param outputDir - Output directory relative to package root (e.g., '', 'browser', 'browser/channel')
 * @returns Export entry configuration
 */
function createExportEntry(outputDir: string): ExportEntry {
  const prefix = outputDir ? `./${outputDir}` : '.'
  return {
    types: `${prefix}/index.d.ts`,
    import: `${prefix}/index.esm.js`,
    require: `${prefix}/index.cjs.js`,
  }
}

/**
 * Generates exports configuration from discovered entry points.
 *
 * @param discovery - Entry point discovery result
 * @returns Exports configuration for package.json
 */
export function generateExportsFromDiscovery(discovery: EntryPointDiscovery): Record<string, unknown> {
  const exports: Record<string, unknown> = {
    './package.json': './package.json',
  }

  for (const entry of discovery.entryPoints) {
    const exportKey = entry.isRoot ? '.' : entry.exportPath
    const outputDir = entry.srcPath
    exports[exportKey] = createExportEntry(outputDir)
  }

  return exports
}

/**
 * Generates package.json for a library based on discovered entry points.
 * Inherits repository, bugs, homepage, and author from root package.json.
 * For libraries with a root entry point, includes main/module/types fields
 * for backwards compatibility with older tools.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 * @param discovery - Entry point discovery result
 * @param workspaceRoot - Absolute path to workspace root
 * @param includeBundle - Whether to include bundle/CDN fields
 */
export function generatePackageJsonFromDiscovery(
  srcPkg: PackageJson,
  outputPath: string,
  discovery: EntryPointDiscovery,
  workspaceRoot: string,
  includeBundle = false
): void {
  const exports = generateExportsFromDiscovery(discovery)

  const rootPkg = readRootPackageJson(workspaceRoot)
  const inheritedFields = getInheritableFields(rootPkg)

  if (includeBundle) {
    exports['./bundle'] = {
      import: './bundle/index.umd.min.js',
      require: './bundle/index.umd.min.js',
    }
  }

  if (discovery.hasRootEntry) {
    const distPkg: PackageJson = {
      ...srcPkg,
      ...inheritedFields,
      main: './index.cjs.js',
      module: './index.esm.js',
      types: './index.d.ts',
      sideEffects: false,
      ...(includeBundle && {
        unpkg: './bundle/index.umd.min.js',
        jsdelivr: './bundle/index.umd.min.js',
      }),
      exports,
    }
    writeOutputPackageJson(outputPath, distPkg)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { main, module, types, ...rest } = srcPkg

    const distPkg: PackageJson = {
      ...rest,
      ...inheritedFields,
      sideEffects: false,
      exports,
    }
    writeOutputPackageJson(outputPath, distPkg)
  }
}

/**
 * Checks if a package has funding configured.
 *
 * @param srcPkg - Source package.json contents
 * @returns True if the package has a funding field
 */
export function hasFunding(srcPkg: PackageJson): boolean {
  return srcPkg.funding !== undefined
}
