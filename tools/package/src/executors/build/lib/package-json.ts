import { readJsonFile, writeJsonFile } from '@nx/devkit'
import { join } from 'node:path'
import type { EntryPointDiscovery, FormatOutputs, PackageJson, IIFEConfig, UMDConfig } from './types'

/** Fields to inherit from root package.json */
const INHERITABLE_FIELDS = ['repository', 'bugs', 'homepage', 'author'] as const

/** Export entry for package.json */
interface ExportEntry {
  types?: string
  import?: string
  require?: string
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
      ;(<Record<string, unknown>>result)[field] = rootPkg[field]
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
 * Creates an export entry for a given output path based on available formats.
 *
 * @param outputDir - Output directory relative to package root
 * @param hasEsm - Whether ESM format is available
 * @param hasCjs - Whether CJS format is available
 * @returns Export entry configuration
 */
function createExportEntry(outputDir: string, hasEsm: boolean, hasCjs: boolean): ExportEntry {
  const prefix = outputDir ? `./${outputDir}` : '.'
  const entry: ExportEntry = {
    types: `${prefix}/index.d.ts`,
  }

  if (hasEsm) {
    entry.import = `${prefix}/index.esm.js`
  }

  if (hasCjs) {
    entry.require = `${prefix}/index.cjs.js`
  }

  return entry
}

/**
 * Generates exports configuration from format outputs.
 *
 * @param discovery - Entry point discovery result
 * @param formatOutputs - Collected format outputs during build
 * @returns Exports configuration for package.json
 */
export function generateExportsFromFormats(discovery: EntryPointDiscovery, formatOutputs: FormatOutputs): Record<string, unknown> {
  const exports: Record<string, unknown> = {
    './package.json': './package.json',
  }

  const esmPaths = new Set(formatOutputs.esm.map((e) => e.exportPath))
  const cjsPaths = new Set(formatOutputs.cjs.map((e) => e.exportPath))

  for (const entry of discovery.entryPoints) {
    const exportKey = entry.isRoot ? '.' : entry.exportPath
    const outputDir = entry.srcPath
    const hasEsm = esmPaths.has(entry.exportPath)
    const hasCjs = cjsPaths.has(entry.exportPath)

    if (hasEsm || hasCjs) {
      exports[exportKey] = createExportEntry(outputDir, hasEsm, hasCjs)
    }
  }

  for (const iife of formatOutputs.iife) {
    const bundleDir = iife.config.output ?? 'bundle'
    exports[`./${bundleDir}`] = {
      import: `./${bundleDir}/index.iife.min.js`,
      require: `./${bundleDir}/index.iife.min.js`,
    }
  }

  for (const umd of formatOutputs.umd) {
    const bundleDir = umd.config.output ?? 'bundle'
    if (!exports[`./${bundleDir}`]) {
      exports[`./${bundleDir}`] = {
        import: `./${bundleDir}/index.umd.min.js`,
        require: `./${bundleDir}/index.umd.min.js`,
      }
    }
  }

  return exports
}

/**
 * Gets the bundle output directory, handling multiple configurations.
 *
 * @param iifeConfigs - IIFE configuration(s)
 * @param umdConfigs - UMD configuration(s)
 * @returns Bundle output directory or undefined
 */
function getBundleOutputDir(
  iifeConfigs: { config: IIFEConfig; entries: unknown[] }[],
  umdConfigs: { config: UMDConfig; entries: unknown[] }[]
): string | undefined {
  if (iifeConfigs.length > 0) {
    return iifeConfigs[0]?.config.output ?? 'bundle'
  }
  if (umdConfigs.length > 0) {
    return umdConfigs[0]?.config.output ?? 'bundle'
  }
  return undefined
}

/**
 * Generates package.json for a library based on format outputs.
 * Inherits repository, bugs, homepage, and author from root package.json.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 * @param discovery - Entry point discovery result
 * @param workspaceRoot - Absolute path to workspace root
 * @param formatOutputs - Collected format outputs during build
 */
export function generatePackageJson(
  srcPkg: PackageJson,
  outputPath: string,
  discovery: EntryPointDiscovery,
  workspaceRoot: string,
  formatOutputs: FormatOutputs
): void {
  const exports = generateExportsFromFormats(discovery, formatOutputs)

  const rootPkg = readRootPackageJson(workspaceRoot)
  const inheritedFields = getInheritableFields(rootPkg)

  const hasBundles = formatOutputs.iife.length > 0 || formatOutputs.umd.length > 0
  const bundleDir = getBundleOutputDir(formatOutputs.iife, formatOutputs.umd)

  const hasEsm = formatOutputs.esm.some((e) => e.isRoot)
  const hasCjs = formatOutputs.cjs.some((e) => e.isRoot)

  if (discovery.hasRootEntry && (hasEsm || hasCjs)) {
    const distPkg: PackageJson = {
      ...srcPkg,
      ...inheritedFields,
      sideEffects: false,
      exports,
    }

    if (hasCjs) {
      distPkg.main = './index.cjs.js'
    }

    if (hasEsm) {
      distPkg.module = './index.esm.js'
    }

    if (hasEsm || hasCjs) {
      distPkg.types = './index.d.ts'
    }

    if (hasBundles && bundleDir) {
      distPkg.unpkg = `./${bundleDir}/index.umd.min.js`
      distPkg.jsdelivr = `./${bundleDir}/index.umd.min.js`
    }

    writeOutputPackageJson(outputPath, distPkg)
  } else {
    const distPkg: PackageJson = {
      ...srcPkg,
      ...inheritedFields,
      sideEffects: false,
      exports,
    }

    delete distPkg.main
    delete distPkg.module
    delete distPkg.types

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
