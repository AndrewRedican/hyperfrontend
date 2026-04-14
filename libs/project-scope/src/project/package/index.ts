/**
 * Package.json reading and dependency inspection utilities with version checks.
 *
 * @module @hyperfrontend/project-scope/project/package
 */
export type { AllDependencies, DependencyMap } from './dependencies'
export type { PackageJson } from './read'
export {
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
} from './dependencies'
export { findNearestPackageJson, readPackageJson, readPackageJsonIfExists } from './read'
