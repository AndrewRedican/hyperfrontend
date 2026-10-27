/**
 * `@hyperfrontend/workspace` - the workspace's own command line, dependency
 * graph and pipeline, and the executors behind the root project's targets.
 */
export type {
  BundleFormatConfig,
  MatrixBuildOptions,
  MatrixDependency,
  MatrixEnvironments,
  MatrixFormats,
  MatrixLibrary,
  MatrixPackageJson,
  MatrixProjectJson,
  SupportLevel,
} from './compatibility-matrix/models'
export { collectMatrixLibraries, shortNameOf } from './compatibility-matrix/collect'
export { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME, refreshCompatibilityDocument } from './compatibility-matrix/refresh'
export { renderCompatibilityDocument } from './compatibility-matrix/render'
