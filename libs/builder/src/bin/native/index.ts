/**
 * Node SEA native binary primitives: config generation, blob prep, host
 * resolution, postject injection, and macOS code-sign cleanup.
 *
 * @module @hyperfrontend/builder/bin/native
 */
export type { BuildNativeBinInputs } from './build-native'
export type { ApplyCodesignInputs, CodesignResult, RemoveCodesignInputs } from './codesign'
export type { DispatchInjectWorkerOptions, InjectWorkerInvocation } from './dispatch'
export type { ResolveHostBinaryInputs } from './host-binary'
export type { InjectBlobInputs } from './inject'
export type { GenerateSeaBlobInputs, GenerateSeaBlobResult } from './sea-blob'
export type { SeaConfigDocument, SeaConfigInputs } from './sea-config'
export type { InjectWorkerJob, InjectWorkerReport } from './worker/types'
export { buildNativeBin } from './build-native'
export { applyCodesign, removeCodesign } from './codesign'
export { dispatchInjectWorker, resolveDefaultInjectWorkerPath } from './dispatch'
export { resolveHostBinary } from './host-binary'
export { injectBlob, NODE_SEA_FUSE, NODE_SEA_MACHO_SEGMENT, NODE_SEA_RESOURCE_NAME } from './inject'
export { currentPlatformMatches, currentPlatformTarget } from './platform-check'
export { generateSeaBlob } from './sea-blob'
export { generateSeaConfig } from './sea-config'
