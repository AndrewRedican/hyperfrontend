/**
 * Build executor library exports.
 *
 * Re-exports all utilities for the build executor.
 */

// Types
export type {
  AssetConfig,
  BuildExecutorOptions,
  BuildContext,
  EntryPoint,
  EntryPointCategory,
  EntryPointDiscovery,
} from './types'

// Path utilities
export {
  resolveOutputPath,
  resolveTsConfigPath,
  joinConfigPath,
  getRelativeProjectPath,
  getSourcePath,
  getEntryPointPath,
  getStandardEntryPath,
} from './paths'

// Entry point discovery
export {
  discoverEntryPoints,
  getEntryPointsByPlatform,
  getSharedEntryPoints,
} from './detect'

// Asset utilities
export {
  copyAssets,
  copyDefaultAssets,
  getDefaultAssetFiles,
} from './assets'

// Package.json utilities
export {
  readProjectPackageJson,
  writeOutputPackageJson,
  generateExportsFromDiscovery,
  generatePackageJsonFromDiscovery,
} from './package-json'

// Library build
export {
  buildUnifiedLibrary,
  createEntryPointRollupConfig,
  createOutputConfigs,
  generateDeclarationsUnified,
} from './build-unified'
