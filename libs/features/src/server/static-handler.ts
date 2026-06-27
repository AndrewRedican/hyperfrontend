import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, normalize, resolve, sep } from 'node:path'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isFile as isFileOnDisk, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'

// note: Minimal MIME table for the asset types a compiled feature/debug-UI bundle ships; anything else falls back to octet-stream.
const CONTENT_TYPES: Readonly<Record<string, string>> = freeze(<const>{
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
})

const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

/** Injectable file-system boundaries for the static handler, defaulted for production. */
export interface StaticHandlerDeps {
  /** Reads a file's bytes. */
  readonly readFile?: (filePath: string) => Buffer
  /** Reports whether a path is a readable file. */
  readonly isFile?: (filePath: string) => boolean
}

/**
 * Maps a file path to its `Content-Type`, falling back to octet-stream.
 *
 * @param filePath - The path whose extension selects the MIME type.
 * @returns The matching content type.
 */
function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? FALLBACK_CONTENT_TYPE
}

/**
 * Extracts the path portion of a request URL, defaulting a missing URL to `/`
 * and dropping any query string.
 *
 * @param url - The raw request URL (`req.url`), which may be `undefined`.
 * @returns The path with no query string.
 *
 * @example Stripping a query string
 * ```typescript
 * requestPath('/app.js?v=2') // '/app.js'
 * ```
 */
export function requestPath(url: string | undefined): string {
  if (url === undefined) {
    return '/'
  }
  const queryAt = url.indexOf('?')
  return queryAt === -1 ? url : url.slice(0, queryAt)
}

/**
 * Resolves a URL path to an absolute path confined to `root`, treating `/` as
 * `index.html` and rejecting any path that escapes the root via `..`.
 *
 * @param root - The absolute directory the path is confined to.
 * @param urlPath - The request path (with or without a query string).
 * @returns The confined absolute path, or `null` when the path escapes `root`.
 */
function confinePath(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(requestPath(urlPath))
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const candidate = resolve(root, normalize(relative))
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null
}

/**
 * Serves a single static file from `root` to the response, sending 403 on a
 * traversal attempt and 404 when the file is missing.
 *
 * @param root - The absolute directory files are served from.
 * @param urlPath - The request path (with or without a query string).
 * @param res - The HTTP response to write.
 * @param deps - Optional file-system overrides.
 *
 * @example Serving an app's `index.html`
 * ```typescript
 * serveFile('/abs/dist', '/', res)
 * ```
 */
export function serveFile(root: string, urlPath: string, res: ServerResponse, deps: StaticHandlerDeps = {}): void {
  const readFile = deps.readFile ?? readFileBuffer
  const isFile = deps.isFile ?? isFileOnDisk

  const filePath = confinePath(root, urlPath)
  if (filePath === null) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }
  if (!isFile(filePath)) {
    res.statusCode = 404
    res.end('Not Found')
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', contentTypeFor(filePath))
  res.end(readFile(filePath))
}

/**
 * Builds an HTTP request handler that serves static files from a single root.
 *
 * @param root - The absolute directory files are served from.
 * @param deps - Optional file-system overrides.
 * @returns A request handler suitable for `http.createServer`.
 *
 * @example Serving a compiled app directory
 * ```typescript
 * const server = createServer(createStaticHandler('/abs/dist'))
 * ```
 */
export function createStaticHandler(root: string, deps: StaticHandlerDeps = {}): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => serveFile(root, req.url ?? '/', res, deps)
}
