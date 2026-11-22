import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isFile as isFileOnDisk, isSymlink as isSymlinkOnDisk, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'

// note: Minimal MIME table for the asset types a compiled feature/debug-UI bundle ships; anything else falls back to octet-stream.
const CONTENT_TYPES: Readonly<Record<string, string>> = freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
} as const)

const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

// note: File a directory URL resolves to, matching what Vite preview and common static hosts serve for `/` and `/sub/`.
const DIRECTORY_INDEX = 'index.html'

/** Injectable file-system boundaries for the static handler, defaulted for production. */
export interface StaticHandlerDeps {
  /** Reads a file's bytes. */
  readonly readFile?: (filePath: string) => Buffer
  /** Reports whether a path is a readable file. */
  readonly isFile?: (filePath: string) => boolean
  /** Reports whether a path is itself a symbolic link, without following it; asked about a file that exists and each directory between it and the root. */
  readonly isSymlink?: (path: string) => boolean
}

/**
 * Maps a file path to its `Content-Type`, falling back to octet-stream.
 *
 * @param filePath - The path whose extension selects the MIME type.
 * @returns The matching content type.
 *
 * @example Looking up a stylesheet's type
 * ```typescript
 * contentTypeFor('/abs/dist/app.css') // 'text/css; charset=utf-8'
 * ```
 */
export function contentTypeFor(filePath: string): string {
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
 * Percent-decodes a request path, treating malformed encodings as unservable
 * rather than letting `decodeURIComponent` throw inside a request handler.
 *
 * @param path - The request path with the query string already stripped.
 * @returns The decoded path, or `null` when the encoding is malformed.
 *
 * @example Rejecting a malformed encoding
 * ```typescript
 * decodeRequestPath('/%') // null
 * ```
 */
export function decodeRequestPath(path: string): string | null {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

/**
 * Confines an already-decoded request path to an absolute path under `root`,
 * rejecting any path that escapes the root via `..`.
 *
 * The root is normalised before the comparison, so a root spelled with a
 * trailing slash or with forward slashes on Windows confines the same files
 * as its canonical spelling. Leading slashes and backslashes are stripped
 * from the request path first, so it is always resolved relative to the root.
 *
 * @param root - The absolute directory the path is confined to.
 * @param decoded - The percent-decoded request path, query string stripped.
 * @returns The confined absolute path, or `null` when the path escapes `root`.
 *
 * @example Rejecting a traversal attempt
 * ```typescript
 * confineDecodedPath('/abs/dist', '/../secret') // null
 * ```
 */
export function confineDecodedPath(root: string, decoded: string): string | null {
  // why: The prefix test below is textual, so the root must carry the native separators and no trailing slash that resolve gives the candidate.
  const base = resolve(root)
  // why: Leading separators of either kind are stripped so the request path is always resolved relative to the root; on Windows a leading backslash would otherwise read as a drive-rooted absolute path.
  const candidate = resolve(base, normalize(decoded.replace(/^[/\\]+/, '')))
  return candidate === base || candidate.startsWith(`${base}${sep}`) ? candidate : null
}

/**
 * Resolves a URL path to an absolute path confined to `root`, rejecting any
 * path that escapes the root via `..` or carries a malformed percent-encoding.
 *
 * @param root - The absolute directory the path is confined to.
 * @param urlPath - The request path (with or without a query string).
 * @returns The confined absolute path, or `null` when the path escapes `root`.
 */
function confinePath(root: string, urlPath: string): string | null {
  const decoded = decodeRequestPath(requestPath(urlPath))
  return decoded === null ? null : confineDecodedPath(root, decoded)
}

/**
 * Reports whether a path confined to `root` is, or sits below, a symbolic
 * link at or below the root.
 *
 * The path and each directory above it are tested up to the root, which is
 * never tested itself: a root that is a link, or that sits below one, serves
 * like any other. Each segment is asked whether it is a link and no real path
 * is compared, so a short name or a letter case that differs from the one on
 * disk is not mistaken for a link.
 *
 * @param root - The absolute directory files are served from.
 * @param confined - An absolute path at or below `root`, as the confinement returns it.
 * @param isSymlink - Tests one path for being a link, without following it.
 * @returns `true` when a link stands between the root and the path, the path included.
 *
 * @example Refusing a file below a linked directory
 * ```typescript
 * passesThroughLink('/abs/dist', '/abs/dist/shared/app.js', (path) => path === '/abs/dist/shared') // true
 * ```
 */
export function passesThroughLink(root: string, confined: string, isSymlink: (path: string) => boolean): boolean {
  const base = resolve(root)
  // why: Every path below the root is longer than the root, so the climb ends at the root without testing it and cannot run past the top of the file system.
  for (let current = confined; current.length > base.length; current = dirname(current)) {
    if (isSymlink(current)) {
      return true
    }
  }
  return false
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
export function directoryLocation(root: string, confined: string, url: string): string {
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
 * No symbolic link at or below the root is followed: a file that is a link, or
 * that sits below a linked directory, answers 404, and a directory whose index
 * is reached through a link is never redirected to. The root itself may be a
 * link.
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
  const isSymlink = deps.isSymlink ?? isSymlinkOnDisk
  // why: The file test follows links, so a file counts as servable only when no segment between it and the root is one; the link test runs second, so a missing path is never tested for links.
  const isServable = (filePath: string): boolean => isFile(filePath) && !passesThroughLink(root, filePath, isSymlink)

  const confined = confinePath(root, urlPath)
  if (confined === null) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }
  const isDirectoryUrl = requestPath(urlPath).endsWith('/')
  const filePath = isDirectoryUrl ? join(confined, DIRECTORY_INDEX) : confined
  // why: An unslashed directory URL redirects rather than serving the index directly, so the browser resolves the page's relative asset URLs against the directory instead of its parent.
  if (!isDirectoryUrl && !isFile(filePath) && isServable(join(filePath, DIRECTORY_INDEX))) {
    res.statusCode = 301
    res.setHeader('Location', directoryLocation(root, confined, urlPath))
    res.end()
    return
  }
  if (!isServable(filePath)) {
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
