import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { ResolvedDevConfig, ResolvedDevDebug } from './config'
import type { StaticHandlerDeps } from './static-handler'
import { createServer as createHttpServer } from 'node:http'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { isFile as isFileOnDisk, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'
import { createStaticHandler, requestPath, serveFile } from './static-handler'

// note: Path prefix the control server serves the compiled debug-UI assets under; the page loads `/__debug/bootstrap.js`.
const DEBUG_PREFIX = '/__debug'

// note: Placeholder the debug-UI HTML embeds; the control server swaps it for the live JSON manifest at request time.
const MANIFEST_TOKEN = 'HF_MANIFEST_PLACEHOLDER'

/** A single running app static server. */
export interface DevServerApp {
  /** App name, matched against the feature name. */
  readonly name: string
  /** The port the app is actually listening on. */
  readonly port: number
  /** The origin URL the app is served from. */
  readonly url: string
}

/** A running app as advertised to the debug UI. */
export interface DevManifestApp {
  /** App name, matched against the feature name. */
  readonly name: string
  /** The origin URL the app is served from. */
  readonly url: string
}

/** The manifest the debug UI reads to discover the running apps and its own toggles. */
export interface DevManifest {
  /** Each running app's name and origin URL. */
  readonly apps: readonly DevManifestApp[]
  /** The resolved debug-UI toggles. */
  readonly debug: ResolvedDevDebug
}

/** A running dev server: the app servers, the debug UI, and a teardown. */
export interface DevServerHandle {
  /** The running app static servers. */
  readonly apps: readonly DevServerApp[]
  /** The manifest exposed to the debug UI. */
  readonly manifest: DevManifest
  /** The debug-UI URL, present only when the debug UI is enabled. */
  readonly debugUrl?: string
  /** Stops every server and resolves once all have closed. */
  close(): Promise<void>
}

/** Injectable boundaries for {@link startDevServer}, defaulted for production. */
export interface DevServerDeps extends StaticHandlerDeps {
  /** Creates an HTTP server from a request handler. */
  readonly createServer?: (handler: (req: IncomingMessage, res: ServerResponse) => void) => Server
  /** Directory the compiled debug-UI assets are read from; defaults to the assets shipped beside this module. */
  readonly assetRoot?: string
}

/**
 * Resolves the directory the compiled debug-UI assets ship in, located beside
 * this module via `__dirname` so the server finds them wherever the package is
 * installed.
 *
 * @returns The absolute debug-UI asset directory.
 */
function defaultAssetRoot(): string {
  /* istanbul ignore if -- @preserve the ESM build has no __dirname; the shipped CommonJS build and the test runner always define it */
  if (typeof __dirname === 'undefined') {
    throw createError('@hyperfrontend/features dev server self-location requires the CommonJS build; inject `assetRoot` otherwise.')
  }
  return join(__dirname, 'debug-ui')
}

/**
 * Reads the listening port from a server, throwing if the address is unexpectedly absent.
 *
 * @param server - A server whose `listen` callback has fired.
 * @returns The bound port.
 */
function addressPort(server: Server): number {
  const address = server.address()
  /* istanbul ignore next -- @preserve a fired listen() callback always yields an AddressInfo for a numeric port */
  if (address === null || typeof address === 'string') {
    throw createError('Dev server failed to report a listening port.')
  }
  return address.port
}

/**
 * Starts a server listening on a port and resolves with the bound port.
 *
 * @param server - The server to start.
 * @param port - The requested port (`0` lets the OS choose, used in tests).
 * @returns A promise for the actually-bound port.
 */
function listen(server: Server, port: number): Promise<number> {
  return createPromise((resolve) => {
    server.listen(port, () => resolve(addressPort(server)))
  })
}

/**
 * Closes a server and resolves once it has stopped accepting connections.
 *
 * @param server - The server to close.
 * @returns A promise that resolves when the server is closed.
 */
function closeServer(server: Server): Promise<void> {
  return createPromise((resolve) => {
    server.close(() => resolve())
  })
}

/**
 * Serves the debug-UI HTML shell with the live manifest injected in place of its placeholder.
 *
 * @param assetRoot - Directory the debug-UI HTML is read from.
 * @param manifest - The manifest embedded into the page.
 * @param res - The HTTP response to write.
 * @param deps - File-system overrides.
 */
function serveDebugIndex(assetRoot: string, manifest: DevManifest, res: ServerResponse, deps: StaticHandlerDeps): void {
  const readFile = deps.readFile ?? readFileBuffer
  const isFile = deps.isFile ?? isFileOnDisk
  const indexPath = join(assetRoot, 'index.html')
  if (!isFile(indexPath)) {
    res.statusCode = 404
    res.end('Debug UI assets not found.')
    return
  }
  // how: function replacement avoids `$`-pattern interpretation when the manifest JSON contains a literal `$`.
  const html = readFile(indexPath)
    .toString('utf-8')
    .replace(MANIFEST_TOKEN, () => stringify(manifest))
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

/**
 * Builds the control-server request handler: the debug UI at `/`, the manifest
 * at `/__apps`, and the compiled debug-UI assets under `/__debug/`.
 *
 * @param manifest - The manifest exposed to the page and the `/__apps` endpoint.
 * @param assetRoot - Directory the debug-UI assets are served from.
 * @param deps - File-system overrides.
 * @returns A request handler for the control server.
 */
function controlHandler(
  manifest: DevManifest,
  assetRoot: string,
  deps: StaticHandlerDeps
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const path = requestPath(req.url)
    if (path === '/') {
      serveDebugIndex(assetRoot, manifest, res, deps)
      return
    }
    if (path === '/__apps') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(stringify(manifest))
      return
    }
    if (path.startsWith(`${DEBUG_PREFIX}/`)) {
      serveFile(assetRoot, path.slice(DEBUG_PREFIX.length), res, deps)
      return
    }
    res.statusCode = 404
    res.end('Not Found')
  }
}

/**
 * Starts the dev server: one static server per app (each on its own port for a
 * distinct origin) plus, when enabled, the control server hosting the debug UI.
 *
 * @param config - The resolved dev-server config.
 * @param deps - Optional server-creation, asset-location, and file-system overrides.
 * @returns A handle exposing the running apps, the manifest, the debug URL, and a teardown.
 *
 * @example Starting a dev server from a resolved config
 * ```typescript
 * const handle = await startDevServer(resolved)
 * console.log(handle.debugUrl)
 * await handle.close()
 * ```
 */
export async function startDevServer(config: ResolvedDevConfig, deps: DevServerDeps = {}): Promise<DevServerHandle> {
  const createServer = deps.createServer ?? createHttpServer
  const assetRoot = deps.assetRoot ?? defaultAssetRoot()

  const servers: Server[] = []
  const apps: DevServerApp[] = []
  for (const app of config.apps) {
    const server = createServer(createStaticHandler(app.outputDir, deps))
    const port = await listen(server, app.port)
    servers.push(server)
    apps.push({ name: app.name, port, url: `http://localhost:${port}/` })
  }

  const manifest: DevManifest = { apps: apps.map((app) => ({ name: app.name, url: app.url })), debug: config.debug }

  let debugUrl: string | undefined
  if (config.debug.enabled) {
    const control = createServer(controlHandler(manifest, assetRoot, deps))
    const port = await listen(control, config.debugPort)
    servers.push(control)
    debugUrl = `http://localhost:${port}/`
  }

  return {
    apps,
    manifest,
    ...(debugUrl !== undefined && { debugUrl }),
    close: () => promiseAll(servers.map(closeServer)).then(() => undefined),
  }
}
