/**
 * Externals resolution primitives: package.json scanning and globals validation
 * for IIFE / UMD bundles.
 *
 * @module @hyperfrontend/builder/bundle/externals
 */
export type { ResolveExternalsOptions } from './resolve-externals'
export { resolveExternals } from './resolve-externals'
export { validateExternalsConfig } from './validate-globals'
