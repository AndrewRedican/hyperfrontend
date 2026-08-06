/**
 * tsc-driven `.d.ts` emission, path flattening, the bundled-dep d.ts pre-pass,
 * per-entry inlining, sibling-subpath dedup, and the emitted-type-surface check.
 *
 * @module @hyperfrontend/builder/bundle/declarations
 */
export type { GenerateDeclarationsResult } from './generate-declarations'
export type { SiblingEntry, SiblingResolverInput } from './sibling-resolver'
export type { DanglingEntryRef, EntryRef } from './verify-entry-refs'
export { runDtsPerEntry } from './dts-per-entry'
export { runDtsPrePass } from './dts-pre-pass'
export { flattenDeclarationPaths } from './flatten-paths'
export { generateDeclarations } from './generate-declarations'
export { pruneOrphanDeclarations } from './prune-orphan-dts'
export { computeSiblingSpecifier, createSiblingExternalizePlugin, dtsPathFor, filterSiblings, findOwningSibling } from './sibling-resolver'
export { collectEntryRefs, collectExportedNames, findDanglingEntryRefs, verifyEntryTypeRefs } from './verify-entry-refs'
