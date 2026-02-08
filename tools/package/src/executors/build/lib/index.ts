/**
 * Build executor library exports.
 *
 * Re-exports all utilities for the build executor.
 */
export type { AssetConfig, BuildExecutorOptions, BuildContext, EntryPoint, EntryPointCategory, EntryPointDiscovery } from './types'

export {
  resolveOutputPath,
  resolveTsConfigPath,
  joinConfigPath,
  getRelativeProjectPath,
  getSourcePath,
  getEntryPointPath,
  getStandardEntryPath,
} from './paths'

export { discoverEntryPoints, getEntryPointsByPlatform, getSharedEntryPoints } from './detect'

export { copyAssets, copyDefaultAssets, copyFundingAsset, getDefaultAssetFiles } from './assets'

export {
  readProjectPackageJson,
  readRootPackageJson,
  writeOutputPackageJson,
  generateExportsFromDiscovery,
  generatePackageJsonFromDiscovery,
  hasFunding,
} from './package-json'

export { buildUnifiedLibrary, createEntryPointRollupConfig, createOutputConfigs, generateDeclarationsUnified } from './build-unified'
