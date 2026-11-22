/**
 * HTTP kernel for Node.js services: a listener with graceful shutdown, a step pipeline, static file serving with compression and conditional requests, and ordered header rules.
 *
 * @module @hyperfrontend/server
 */
export type { ServeStep, ServeStepContext, StaticRequest, StaticResponse } from './static/serve-pipeline'
export type { ServeStepDeps } from './static/serve-steps'
export type { StaticHandlerDeps } from './static/static-handler'
export type { StaticServeDeps, StaticServerHandle } from './static/static-serve'
export { addressPort, closeServer, listen } from './listen'
export { waitForShutdown } from './shutdown'
export { buildCompressionStep, negotiateEncoding } from './static/serve-compression'
export { headerValue, plainResponse, runSteps } from './static/serve-pipeline'
export { buildServeSteps } from './static/serve-steps'
export {
  confineDecodedPath,
  contentTypeFor,
  createStaticHandler,
  decodeRequestPath,
  directoryLocation,
  requestPath,
  serveFile,
} from './static/static-handler'
export { createServeListener, startStaticServer } from './static/static-serve'
