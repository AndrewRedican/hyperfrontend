/**
 * Build executor library exports.
 *
 * Re-exports all utilities for the build executor.
 */

// Types
export type {
  AssetConfig,
  BuildExecutorOptions,
  LibraryType,
  BuildContext,
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

// Library type detection
export {
  detectLibraryType,
  isIsomorphicProject,
  getIsomorphicEntryPoints,
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
  generateStandardPackageJson,
  generateIsomorphicPackageJson,
  generateDistPackageJson,
  getStandardExports,
  getIsomorphicExports,
} from './package-json'

// Standard library build
export {
  buildStandardLibrary,
  createStandardRollupConfig,
  createStandardOutputConfigs,
  getStandardEntryFile,
} from './build-standard'

// Isomorphic library build
export {
  buildIsomorphicLibrary,
  createIsomorphicRollupConfig,
  createIsomorphicOutputConfigs,
  generateDeclarations,
  getIsomorphicEntryFile,
} from './build-isomorphic'
