/**
 * Project utilities for file traversal, config detection, package.json operations, and root finding.
 *
 * @module @hyperfrontend/project-scope/project
 */
export type { ConfigPatternInfo, ConfigType, DetectedConfig, DetectConfigOptions, ParsedConfig } from './config'
export type { AllDependencies, DependencyMap, PackageJson } from './package'
export type { FindOptions, WalkEntry, WalkOptions, WalkVisitor, WalkVisitorResult } from './traversal'
export {
  clearConfigDetectionCache,
  CONFIG_PATTERNS,
  detectConfigs,
  findConfigFile,
  getConfigPatternsByType,
  parseConfig,
  parseJsonConfig,
  parseYamlConfig,
} from './config'
export {
  findNearestPackageJson,
  getAllDependencies,
  getDependencies,
  getDependencyVersion,
  getDevDependencies,
  getPeerDependencies,
  getProductionDependencies,
  getWorkspaces,
  hasDependency,
  hasInstalledPackage,
  hasWorkspaces,
  readPackageJson,
  readPackageJsonIfExists,
} from './package'
export { findGitRoot, findProjectRoot, findRootDirectory, findWorkspaceRoot, ROOT_MARKERS, WORKSPACE_MARKERS } from './root'
export { findDirectories, findFiles, findFilesInTree, walkDirectory, walkTree } from './traversal'
