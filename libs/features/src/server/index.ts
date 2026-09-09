/**
 * Serves feature apps: one static server per app, the in-browser debug UI that
 * drives them, and the production static server behind `hf serve`.
 *
 * @module @hyperfrontend/features/server
 */
export type { ResolvedDevApp, ResolvedDevConfig, ResolvedDevDebug, ResolveDevConfigDeps, ResolveDevConfigOptions } from './config'
export type { DevManifest, DevManifestApp, DevServerApp, DevServerDeps, DevServerHandle } from './dev-server'
export type { ResolvedServeConfig, ResolveServeConfigDeps, ResolveServeConfigOptions } from './serve-config'
export type { ServeStep, ServeStepContext, StaticRequest, StaticResponse } from './serve-pipeline'
export type { ServeStepDeps } from './serve-steps'
export type { StaticHandlerDeps } from './static-handler'
export type { StaticServeDeps, StaticServerHandle } from './static-serve'
export { resolveDevConfig, validateApps, validateDevApp, validateDevConfig } from './config'
export { startDevServer } from './dev-server'
export { buildCompressionStep, negotiateEncoding } from './serve-compression'
export { resolveServeConfig, validateHeaderRule, validateServeConfig } from './serve-config'
export { headerValue, plainResponse, runSteps } from './serve-pipeline'
export { buildServeSteps } from './serve-steps'
export {
  confineDecodedPath,
  contentTypeFor,
  createStaticHandler,
  decodeRequestPath,
  directoryLocation,
  requestPath,
  serveFile,
} from './static-handler'
export { createServeListener, startStaticServer } from './static-serve'
