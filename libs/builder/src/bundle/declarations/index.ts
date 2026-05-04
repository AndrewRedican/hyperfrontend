/**
 * tsc-driven `.d.ts` emission, post-emit path flattening, and the bundled-dep
 * d.ts pre-pass / per-entry d.ts inlining (Phase 11.5).
 *
 * @module @hyperfrontend/builder/bundle/declarations
 */
export type { GenerateDeclarationsResult } from './generate-declarations'
export { runDtsPerEntry } from './dts-per-entry'
export { runDtsPrePass } from './dts-pre-pass'
export { flattenDeclarationPaths } from './flatten-paths'
export { generateDeclarations } from './generate-declarations'
