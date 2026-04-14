/**
 * Build tool detection for Webpack, Vite, Rollup, esbuild, Babel, SWC, and Parcel.
 *
 * @module @hyperfrontend/project-scope/tech/build
 */
export type { BuildToolDetection, BuildToolDetector } from './types'
export { BABEL_CONFIG_PATTERNS, babelDetector } from './babel'
export { buildToolDetectors, detectBuildTools } from './detect-all'
export { esbuildDetector } from './esbuild'
export { PARCEL_CONFIG_PATTERNS, parcelDetector } from './parcel'
export { ROLLUP_CONFIG_PATTERNS, rollupDetector } from './rollup'
export { SWC_CONFIG_PATTERNS, swcDetector } from './swc'
export { VITE_CONFIG_PATTERNS, viteDetector } from './vite'
export { WEBPACK_CONFIG_PATTERNS, webpackDetector } from './webpack'
