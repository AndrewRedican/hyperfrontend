/**
 * tsc-driven `.d.ts` emission, path flattening, the bundled-dep d.ts pre-pass,
 * per-entry inlining, and sibling-subpath dedup.
 *
 * @module @hyperfrontend/builder/bundle/declarations
 */
export type { GenerateDeclarationsResult } from './generate-declarations'
export type { SiblingEntry, SiblingResolverInput } from './sibling-resolver'
export { runDtsPerEntry } from './dts-per-entry'
export { runDtsPrePass } from './dts-pre-pass'
export { flattenDeclarationPaths } from './flatten-paths'
export { generateDeclarations } from './generate-declarations'
export { pruneOrphanDeclarations } from './prune-orphan-dts'
export { computeSiblingSpecifier, createSiblingExternalizePlugin, dtsPathFor, filterSiblings, findOwningSibling } from './sibling-resolver'
