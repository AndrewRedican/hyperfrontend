/**
 * `@hyperfrontend/pipeline` - this repository's pipeline and the tools around it: the
 * compatibility document, and the environments the pipeline exercises a project on.
 */
export type {
  BundleFormatConfig,
  MatrixBuildOptions,
  MatrixDependency,
  MatrixEnvironments,
  MatrixFormats,
  MatrixLibrary,
  MatrixOperatingSystems,
  MatrixPackageJson,
  MatrixProjectJson,
  SupportLevel,
} from './compatibility-matrix/models'
export { collectMatrixLibraries, shortNameOf } from './compatibility-matrix/collect'
export { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME, refreshCompatibilityDocument } from './compatibility-matrix/refresh'
export { renderCompatibilityDocument } from './compatibility-matrix/render'
export { exercisedEnvironments } from './pipeline/fold'
