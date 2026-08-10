import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
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

// note: File a directory URL resolves to, matching what Vite preview and common static hosts serve for `/` and `/sub/`.
const DIRECTORY_INDEX = 'index.html'

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
 * Resolves a URL path to an absolute path confined to `root`, rejecting any
 * path that escapes the root via `..`.
 *
 * @param root - The absolute directory the path is confined to.
 * @param urlPath - The request path (with or without a query string).
 * @returns The confined absolute path, or `null` when the path escapes `root`.
 */
function confinePath(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(requestPath(urlPath))
  const candidate = resolve(root, normalize(decoded.replace(/^\/+/, '')))
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null
}

/**
 * Builds the slashed directory URL to redirect an unslashed request to.
 *
 * The location is derived from the resolved path rather than the raw request,
 * so it is always a single-slash path relative to this server's own root: a
 * request that writes an authority into the URL (`//example.com/../host`) is
 * answered with the directory it actually resolved to, never with a location
 * pointing off this origin.
 *
 * @param root - The absolute directory files are served from.
 * @param confined - The resolved absolute path, already confined to `root`.
 * @param url - The raw request URL, read only for its query string.
 * @returns The root-relative directory URL, ending in a slash.
 *
 * @example Redirecting a directory request
 * ```typescript
 * directoryLocation('/srv', '/srv/host', '/host?debug=1') // '/host/?debug=1'
 * ```
 */
function directoryLocation(root: string, confined: string, url: string): string {
  const queryAt = url.indexOf('?')
  const query = queryAt === -1 ? '' : url.slice(queryAt)
  const relativePath = relative(root, confined)
  // why: Encoding each resolved segment keeps a directory name that contains reserved characters from writing new structure into the location.
  const directory = relativePath === '' ? '' : `${relativePath.split(sep).map(encodeURIComponent).join('/')}/`
  return `/${directory}${query}`
}

/**
 * Serves a single static file from `root` to the response, sending 403 on a
 * traversal attempt and 404 when the file is missing.
 *
 * A URL ending in `/` serves that directory's `index.html`, so `/` and
 * `/host/` reach the pages a multi-page build emits as `index.html` and
 * `host/index.html`. A directory URL written without the trailing slash
 * (`/host`) answers `301` to the slashed form, keeping relative asset URLs on
 * the page resolvable.
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
 *
 * @example Serving a companion page from a multi-page build
 * ```typescript
 * serveFile('/abs/dist', '/host/', res) // sends /abs/dist/host/index.html
 * ```
 */
export function serveFile(root: string, urlPath: string, res: ServerResponse, deps: StaticHandlerDeps = {}): void {
  const readFile = deps.readFile ?? readFileBuffer
  const isFile = deps.isFile ?? isFileOnDisk

  const confined = confinePath(root, urlPath)
  if (confined === null) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }
  const isDirectoryUrl = requestPath(urlPath).endsWith('/')
  const filePath = isDirectoryUrl ? join(confined, DIRECTORY_INDEX) : confined
  // why: An unslashed directory URL redirects rather than serving the index directly, so the browser resolves the page's relative asset URLs against the directory instead of its parent.
  if (!isDirectoryUrl && !isFile(filePath) && isFile(join(filePath, DIRECTORY_INDEX))) {
    res.statusCode = 301
    res.setHeader('Location', directoryLocation(root, confined, urlPath))
    res.end()
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
