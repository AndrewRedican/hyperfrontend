/**
 * `@hyperfrontend/workspace` - Nx plugin for LLM-optimized reports and the
 * workspace documents derived from every package's manifests.
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
