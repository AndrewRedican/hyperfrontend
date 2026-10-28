/**
 * The manifests Nx discovers in a plugin package, `executors.json` and `generators.json`, and the
 * checks that every entry can be read.
 *
 * @module @hyperfrontend/integration-nx/manifests
 */
export type { ExecutorEntry, ExecutorsManifest, GeneratorEntry, GeneratorsManifest, ManifestIssue } from './model'
export type { FileExists } from './validate'
export { validateExecutorsManifest, validateGeneratorsManifest } from './validate'
