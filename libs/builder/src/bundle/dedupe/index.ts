/**
 * Additive post-emit pass that hoists first-party modules inlined into multiple
 * per-entry bundles into shared chunks. See {@link hoistSharedFirstParty}.
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
