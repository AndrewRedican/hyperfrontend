/**
 * Externals resolution primitives: package.json scanning, Rollup external predicates,
 * and globals validation for IIFE / UMD bundles.
 *
 * @module @hyperfrontend/builder/bundle/externals
 */
export type { ExternalPredicate } from './external-fn'
export type { ResolveExternalsOptions } from './resolve-externals'
export { createBundleExternalFn, createExternalFn } from './external-fn'
export { resolveExternals } from './resolve-externals'
export { validateExternalsConfig } from './validate-globals'
