/**
 * Shared-first-party dedupe: an additive post-emit pass that lifts first-party
 * modules inlined into multiple per-entry bundles into shared
 * `_shared/<srcPath>/index.<fmt>.js` chunks and rewrites each consuming entry to
 * import them. {@link hoistSharedFirstParty} is the entry point; it processes the
 * already-bundled `esm`/`cjs` outputs and only hoists copies {@link planHoists}
 * proves safe (structurally identical, references resolvable, initialization
 * cycle-free), so per-entry isolated bundling is left intact and the worst case
 * is output identical to the input. The remaining exports — module attribution
 * ({@link attribute}, {@link indexOwners}), chunk planning, extraction, and entry
 * rewriting — are the composable stages that pass runs through.
 *
 * @module @hyperfrontend/builder/bundle/dedupe
 */
export type { EntryDecl, ImportBinding, ModuleKey, OwnerIndex, ParsedEntry } from './attribute-modules'
export type { ChunkPlan, CrossImport, CrossRef, DepImport, DepRef, ModuleResolution } from './extract-chunk'
export type { HoistReport } from './hoist-shared'
export type { EntryInput, PlannedModule } from './plan-hoists'
export type { EntryHoist } from './rewrite-entry'
export { attribute, baseName, chunkFileName, fingerprintOf, indexOwners, parseEntry, sharedDirFor } from './attribute-modules'
export { renderChunk, resolveModuleRefs } from './extract-chunk'
export { hoistSharedFirstParty } from './hoist-shared'
export { planHoists } from './plan-hoists'
export { rewriteEntry } from './rewrite-entry'
