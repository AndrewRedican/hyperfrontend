import type {
  EntryPointDiscovery,
  FormatOutputs,
  PackageJson,
  ConditionalExport,
  ExportValue,
  BuildExecutorOptions,
} from './types'
import { join } from 'node:path'
import { readJsonFile, writeJsonFile } from '@nx/devkit'
import {entries, fromEntries} from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import {createSet} from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isWorkspacePackage } from './externals'

/** Fields to inherit from root package.json */
const INHERITABLE_FIELDS = <const>['repository', 'bugs', 'homepage', 'author']

/** Export entry for package.json */
interface ExportEntry {
  /** Path to TypeScript declarations */
  types?: string
  /** Path to ESM entry point */
  import?: string
  /** Path to CommonJS entry point */
  require?: string
}

/**
 * CDN paths for unpkg and jsdelivr.
 */
interface CdnPaths {
  /** Path for unpkg CDN */
  unpkg: string
  /** Path for jsdelivr CDN */
  jsdelivr: string
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
 * Extracts output directory from source export path.
 *
 * @example
 * "./src/lib/queue/index.js" → "lib/queue"
 * "./src/browser/index.ts" → "browser"
 * "./src/index.ts" → "" (root entry)
 *
 * @param srcPath - Source export path (string or conditional exports object)
 * @returns Output directory relative to dist root, or empty string for root
 */
function extractOutputDirFromSourcePath(srcPath: ExportValue): string {
  const path =
    typeof srcPath === 'string'
      ? srcPath
      : ((<ConditionalExport>srcPath).import ??
        (<ConditionalExport>srcPath).require ??
        (<ConditionalExport>srcPath).default ??
        '')

  const subDirMatch = path.match(/^\.\/src\/(.+?)\/index\.[jt]s$/)
  if (subDirMatch && subDirMatch[1]) {
    return subDirMatch[1]
  }

  const rootMatch = path.match(/^\.\/src\/index\.[jt]s$/)
  if (rootMatch) {
    return ''
  }

  return ''
}

/**
 * Generates exports configuration from format outputs.
 * Uses source-exports-first strategy: only exports declared in source package.json
 * are included in the dist package.json. Internal modules are still built but not advertised.
 *
 * @param discovery - Entry point discovery result
 * @param formatOutputs - Collected format outputs during build
 * @param srcPkg - Source package.json to honor export aliases (authoritative)
 * @returns Exports configuration for package.json
 */
export function generateExportsFromFormats(
  discovery: EntryPointDiscovery,
  formatOutputs: FormatOutputs,
  srcPkg?: PackageJson
): Record<string, unknown> {
  const exports: Record<string, unknown> = {
    './package.json': './package.json',
  }

  const esmPaths = createSet(formatOutputs.esm.map((e) => e.exportPath))
  const cjsPaths = createSet(formatOutputs.cjs.map((e) => e.exportPath))

  const srcExports = srcPkg?.exports
  if (srcExports && typeof srcExports === 'object') {
    for (const [exportKey, srcPath] of entries(srcExports)) {
      if (exportKey === './package.json') continue

      const outputDir = extractOutputDirFromSourcePath(srcPath)
      const discoveryPath = outputDir ? `./${outputDir}` : '.'
      const hasEsm = esmPaths.has(discoveryPath)
      const hasCjs = cjsPaths.has(discoveryPath)

      if (hasEsm || hasCjs) {
        exports[exportKey] = createExportEntry(outputDir, hasEsm, hasCjs)
      }
    }
  } else {
    if (discovery.hasRootEntry) {
      const hasEsm = esmPaths.has('.')
      const hasCjs = cjsPaths.has('.')
      if (hasEsm || hasCjs) {
        exports['.'] = createExportEntry('', hasEsm, hasCjs)
      }
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
 * Filters out workspace dependencies from package.json.
 * Workspace packages (\@hyperfrontend/*) are bundled into the output,
 * so they should not be listed as dependencies in the published package.
 *
 * @param srcPkg - Source package.json contents
 * @returns Package.json with workspace dependencies removed
 */
function filterWorkspaceDependencies(srcPkg: PackageJson): PackageJson {
  const filtered = { ...srcPkg }

  if (filtered.dependencies) {
    const externalDeps = entries(filtered.dependencies).filter(([name]) => !isWorkspacePackage(name))
    if (externalDeps.length > 0) {
      filtered.dependencies = fromEntries(externalDeps)
    } else {
      delete filtered.dependencies
    }
  }

  // Note: peerDependencies are kept as-is since they represent optional integrations

  return filtered
}

/**
 * Determines the CDN (unpkg/jsdelivr) paths for the package.
 * Priority: explicit config > UMD bundle path > IIFE bundle path
 *
 * @param formatOutputs - Collected format outputs during build
 * @param options - Build executor options
 * @returns Object with unpkg and jsdelivr paths, or undefined if no bundles
 */
function getCdnPaths(
  formatOutputs: FormatOutputs,
  options?: Pick<BuildExecutorOptions, 'unpkg' | 'jsdelivr'>
): CdnPaths | undefined {
  const hasUmd = formatOutputs.umd.length > 0
  const hasIife = formatOutputs.iife.length > 0

  if (!hasUmd && !hasIife) {
    return undefined
  }

  let defaultPath: string | undefined

  if (hasUmd) {
    const umdDir = formatOutputs.umd[0]?.config.output ?? 'bundle'
    defaultPath = `./${umdDir}/index.umd.min.js`
  } else if (hasIife) {
    const iifeDir = formatOutputs.iife[0]?.config.output ?? 'bundle'
    defaultPath = `./${iifeDir}/index.iife.min.js`
  }

  if (!defaultPath) {
    return undefined
  }

  return {
    unpkg: options?.unpkg ?? defaultPath,
    jsdelivr: options?.jsdelivr ?? defaultPath,
  }
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
 * @param options - Build executor options (for custom unpkg/jsdelivr paths)
 */
export function generatePackageJson(
  srcPkg: PackageJson,
  outputPath: string,
  discovery: EntryPointDiscovery,
  workspaceRoot: string,
  formatOutputs: FormatOutputs,
  options?: Partial<BuildExecutorOptions>
): void {
  const exports = generateExportsFromFormats(discovery, formatOutputs, srcPkg)

  const rootPkg = readRootPackageJson(workspaceRoot)
  const inheritedFields = getInheritableFields(rootPkg)

  const cdnPaths = getCdnPaths(formatOutputs, options)

  const hasEsm = formatOutputs.esm.some((e) => e.isRoot)
  const hasCjs = formatOutputs.cjs.some((e) => e.isRoot)

  const filteredSrcPkg = filterWorkspaceDependencies(srcPkg)

  const distPkg: PackageJson = {
    ...filteredSrcPkg,
    ...inheritedFields,
    sideEffects: false,
    exports,
  }

  if (discovery.hasRootEntry && (hasEsm || hasCjs)) {
    if (hasCjs) {
      distPkg.main = './index.cjs.js'
    }

    if (hasEsm) {
      distPkg.module = './index.esm.js'
    }

    if (hasEsm || hasCjs) {
      distPkg.types = './index.d.ts'
    }
  } else {
    delete distPkg.main
    delete distPkg.module
    delete distPkg.types
  }

  if (cdnPaths) {
    distPkg.unpkg = cdnPaths.unpkg
    distPkg.jsdelivr = cdnPaths.jsdelivr
  }

  writeOutputPackageJson(outputPath, distPkg)
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
