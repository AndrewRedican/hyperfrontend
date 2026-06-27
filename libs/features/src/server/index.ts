/**
 * Dev server and debug UI for testing host/hostee interactions together.
 *
 * Serves each app's compiled output on its own port and hosts the in-browser
 * debug UI (display-mode, resize, message-log, and security controls) at the
 * root of a control server.
 *
 * @module @hyperfrontend/features/server
 */
export type { ResolvedDevApp, ResolvedDevConfig, ResolvedDevDebug, ResolveDevConfigDeps, ResolveDevConfigOptions } from './config'
export type { DevManifest, DevManifestApp, DevServerApp, DevServerDeps, DevServerHandle } from './dev-server'
export type { StaticHandlerDeps } from './static-handler'
export { resolveDevConfig, validateApps, validateDevApp, validateDevConfig } from './config'
export { startDevServer } from './dev-server'
export { createStaticHandler, requestPath, serveFile } from './static-handler'
