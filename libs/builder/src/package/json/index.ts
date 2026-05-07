/**
 * package.json synthesis primitives — read, inherit, filter, generate exports,
 * resolve CDN paths, synthesize the dist manifest, and write it to disk.
 *
 * @module @hyperfrontend/builder/package/json
 */
export type { CdnPathOverrides, CdnPaths } from './cdn-paths'
export type { SynthesizePackageJsonOptions } from './synthesize'
export { getCdnPaths } from './cdn-paths'
export { computeDefaultFilesAllowlist } from './files-allowlist'
export { filterBundledDepsFromOutput, filterWorkspaceDepsFromOutput } from './filter-deps'
export { generateExportsFromFormats } from './generate-exports'
export { inheritFields } from './inherit-fields'
export { readProjectPackageJson } from './read-package-json'
export { synthesizePackageJson } from './synthesize'
export { writeOutputPackageJson } from './write'
