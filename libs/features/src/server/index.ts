/**
 * Dev server, debug UI, and production static server for feature apps.
 *
 * Serves each app's compiled output on its own port and hosts the in-browser
 * debug UI (display-mode, resize, message-log, and security controls) at the
 * root of a control server. The same static core also powers `hf serve`, the
 * production server with compression, conditional requests, and header rules,
 * whose pipeline is open for custom steps.
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
