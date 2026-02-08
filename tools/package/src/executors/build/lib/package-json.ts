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
  [key: string]: unknown
}

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
export function generateExportsFromDiscovery(
  discovery: EntryPointDiscovery
): Record<string, unknown> {
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
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 * @param discovery - Entry point discovery result
 */
export function generatePackageJsonFromDiscovery(
  srcPkg: PackageJson,
  outputPath: string,
  discovery: EntryPointDiscovery
): void {
  const exports = generateExportsFromDiscovery(discovery)

  // If there's a root entry, keep main/module/types for backwards compatibility
  if (discovery.hasRootEntry) {
    const distPkg: PackageJson = {
      ...srcPkg,
      main: './index.cjs.js',
      module: './index.esm.js',
      types: './index.d.ts',
      exports,
    }
    writeOutputPackageJson(outputPath, distPkg)
  } else {
    // No root entry - remove main/module/types
    const { main, module, types, ...rest } = srcPkg
    void main
    void module
    void types

    const distPkg: PackageJson = {
      ...rest,
      exports,
    }
    writeOutputPackageJson(outputPath, distPkg)
  }
}
