import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep, StaticResponse } from './serve-pipeline'
import { dirname, join } from 'node:path'
import { getFileStat, isFile as isFileOnDisk, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'
import { applyErrorHeaderRules, applyFailureHeaderRules, applyHeaderRules } from '../policy/expand'
import { compressionStep } from './serve-compression'
import { plainResponse } from './serve-pipeline'
import { realPathOnDisk, servedPath, storedFile } from './served-path'
import { confineDecodedPath, contentTypeFor, decodeRequestPath, directoryLocation, passesThroughLink, requestPath } from './static-handler'

// note: File a directory URL resolves to, matching the dev server and common static hosts.
const DIRECTORY_INDEX = 'index.html'

// note: The artifact-carried config never serves; it configures the server and is not site content.
const CONFIG_PREFIX = 'hf-serve.config.'

/** Injectable file-system boundaries for the built-in serve steps, defaulted for production. */
export interface ServeStepDeps {
  /** Reads a file's bytes. */
  readonly readFile?: (filePath: string) => Buffer
  /** Reports whether a path is a readable file. */
  readonly isFile?: (filePath: string) => boolean
  /** Reads the stats of a path without following a link in its last segment, or `null` when the path is unreadable; asked about a file and each directory between it and the root. */
  readonly stat?: (filePath: string) => FileStats | null
  /** Looks up the path the file system stores a path under, every link resolved and every name in the spelling its directory lists, or `null` when it cannot tell; asked about the root and then the file, once for each request that reaches a file, and about the root and a directory's index before a redirect to that directory. A spec that injects the file reads injects this as well, or the disk is asked about a site it does not hold. */
  readonly realPath?: (path: string) => string | null
}

/**
 * Builds the step that answers non-GET/HEAD methods with 405, so the static
 * pipeline only ever reads the site. The refusal carries the header rules
 * that match the request path, since it never reaches the step that applies
 * them to everything else. It takes no cache header from them as written, and
 * is marked `Cache-Control: no-store` when a matching rule names one.
 *
 * @param config - The resolved serving plan carrying the rules.
 * @returns A step that answers 405 for a write method and delegates otherwise.
 */
function buildMethodGuard(config: ResolvedServeConfig): ServeStep {
  return (request, _context, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const refusal = plainResponse(405, 'Method Not Allowed')
      return {
        ...refusal,
        headers: applyErrorHeaderRules(config.headers, requestPath(request.url), { ...refusal.headers, Allow: 'GET, HEAD' }),
      }
    }
    return next()
  }
}

/**
 * Builds the step that applies the config's ordered header rules onto every
 * response, later rules overriding earlier ones one header at a time.
 *
 * Rules match against the served file's root-relative path when the request
 * reached a file (so `suffix: '.html'` covers a directory URL's `index.html`),
 * and against the request path otherwise. The file's path is read in the
 * spelling the file system stores, so a request that reached the file under
 * another letter case or a short name is sent the headers of that file.
 *
 * An answer with a status of 400 or above takes every matching header except
 * the cache headers, so a lifetime a rule wrote for a file is never given to
 * the refusal answered in its place. Where a matching rule names a cache
 * header, the answer carries `Cache-Control: no-store` instead; where none
 * does, it carries no cache header.
 *
 * @param config - The resolved serving plan carrying the rules.
 * @param deps - Injectable file-system boundaries.
 * @returns A step that rewrites matching responses' headers.
 */
function buildHeaderRulesStep(config: ResolvedServeConfig, deps: ServeStepDeps): ServeStep {
  const realPath = deps.realPath ?? realPathOnDisk
  return (request, context, next) => {
    const response = next()
    if (config.headers.length === 0) {
      return response
    }
    // why: The file step has already read where the file is stored, so the rules read its answer and ask the volume nothing more.
    const path = context.filePath === undefined ? requestPath(request.url) : storedFile(context, context.filePath, realPath).path
    // why: A lifetime written for a file would pin its absence in every cache between the server and the reader, and a rule that forbids storing must still hold for the error.
    const applyRules = response.status >= 400 ? applyErrorHeaderRules : applyHeaderRules
    return { ...response, headers: applyRules(config.headers, path, response.headers) }
  }
}

/**
 * Builds the answer to a request the pipeline failed on: a plain 500 carrying
 * the header rules that match the request path, and `Cache-Control: no-store`
 * whatever a rule set, so a fault is never kept under a lifetime written for
 * the file. Every other lifetime a matching rule wrote is left out: `Expires`,
 * which a cache that reads no `Cache-Control` goes by, and
 * `Surrogate-Control`, `X-Accel-Expires` and any targeted field whose name
 * ends with `-Cache-Control`, each of which a cache that reads it ranks above
 * `Cache-Control`.
 *
 * Rules that no validator saw can make the fold itself throw; the answer then
 * carries no rule header.
 *
 * @param config - The resolved serving plan carrying the rules.
 * @param url - The raw request URL, read for its path.
 * @returns The response value.
 *
 * @example Answering a request whose step threw
 * ```typescript
 * failureResponse({ root: '/abs/dist', port: 0, log: false, headers: [{ headers: { 'X-Frame-Options': 'DENY' } }] }, '/app.js')
 * // => status 500 with Content-Type, X-Frame-Options: DENY and Cache-Control: no-store
 * ```
 *
 * @example Answering under a rule that wrote a lifetime for a content delivery network
 * ```typescript
 * const assets = { prefix: '/assets/', headers: { 'Cache-Control': 'max-age=31536000', 'CDN-Cache-Control': 'max-age=31536000' } }
 * failureResponse({ root: '/abs/dist', port: 0, log: false, headers: [assets] }, '/assets/app.js')
 * // => status 500 with Content-Type and Cache-Control: no-store
 * ```
 */
export function failureResponse(config: ResolvedServeConfig, url: string): StaticResponse {
  const failure = plainResponse(500, 'Internal Server Error')
  try {
    return { ...failure, headers: applyFailureHeaderRules(config.headers, requestPath(url), failure.headers) }
  } catch {
    return failure
  }
}

/**
 * Computes a weak ETag from a file's size and modification time, enough to
 * change whenever a deployment replaces the file, without hashing its bytes.
 *
 * @param stats - The file's stats.
 * @returns The weak ETag value.
 */
function weakEtag(stats: FileStats): string {
  return `W/"${stats.size.toString(16)}-${stats.modified.getTime().toString(16)}"`
}

/**
 * Reports whether an `If-None-Match` header matches an ETag under weak
 * comparison.
 *
 * @param header - The raw `If-None-Match` value.
 * @param etag - The response's ETag.
 * @returns `true` when any listed tag (or `*`) matches.
 */
function etagMatches(header: string | undefined, etag: string): boolean {
  if (header === undefined) {
    return false
  }
  const opaque = etag.replace(/^W\//, '')
  return header.split(',').some((candidate) => {
    const token = candidate.trim()
    return token === '*' || token.replace(/^W\//, '') === opaque
  })
}

/**
 * Reports whether a path contains a segment the server never serves:
 * dotfiles (excluding the `.`/`..` navigation segments the resolver handles)
 * and the artifact-carried config file.
 *
 * @param decoded - The percent-decoded request path, or the path a file is stored under below the root.
 * @returns `true` when the path must answer 404.
 */
function hasHiddenSegment(decoded: string): boolean {
  // why: Segments split on both separators and the config name compares case-folded, so neither a backslash path nor a case-insensitive filesystem reaches what the forward-slash spelling hides.
  return decoded.split(/[/\\]/).some((segment) => {
    if (segment.toLowerCase().startsWith(CONFIG_PREFIX)) {
      return true
    }
    return segment.startsWith('.') && segment !== '.' && segment !== '..'
  })
}

/**
 * Builds the terminal step: confines the request path to the root, resolves
 * directory URLs to their `index.html` (redirecting the unslashed form),
 * answers conditional requests with 304, and serves the file bytes. No
 * symbolic link at or below the root is followed: a file that is a link, or
 * that sits below a linked directory, answers 404, and a directory whose index
 * is reached through a link is never redirected to. The root itself may be a
 * link.
 *
 * What is hidden is judged twice: by the text of the request, and then by the
 * names the file is stored under below the root, so a dotfile or the config
 * file answers 404 under a short name or any other spelling the volume
 * resolves to it. Where the stored names cannot be told, the text of the
 * request alone decides.
 *
 * @param config - The resolved serving plan.
 * @param deps - Injectable file-system boundaries.
 * @returns The file-serving step; it never calls `next`.
 */
function buildServeFileStep(config: ResolvedServeConfig, deps: ServeStepDeps): ServeStep {
  const readFile = deps.readFile ?? readFileBuffer
  const isFile = deps.isFile ?? isFileOnDisk
  const realPath = deps.realPath ?? realPathOnDisk
  // why: Stats come from lstat so a symlink reports itself instead of its target; the root confinement compares path text and resolves no link, so these stats are the only thing that keeps a link from leading out of the site.
  const stat = deps.stat ?? ((filePath: string) => getFileStat(filePath, false))
  // why: The link test reads the same stats boundary as the file itself, so a site injected as values is never looked up on disk.
  const isSymlink = (path: string): boolean => stat(path)?.isSymlink === true
  // why: The file test follows links, so the redirect probe also demands that nothing between the index and the root is one.
  const isLinkFreeFile = (filePath: string): boolean => isFile(filePath) && !passesThroughLink(config.root, filePath, isSymlink)
  return (request, context) => {
    const decoded = decodeRequestPath(requestPath(request.url))
    if (decoded === null) {
      return plainResponse(400, 'Bad Request')
    }
    if (hasHiddenSegment(decoded)) {
      return plainResponse(404, 'Not Found')
    }
    const confined = confineDecodedPath(config.root, decoded)
    if (confined === null) {
      return plainResponse(403, 'Forbidden')
    }
    const isDirectoryUrl = decoded.endsWith('/')
    const filePath = isDirectoryUrl ? join(confined, DIRECTORY_INDEX) : confined
    // why: An unslashed directory URL redirects rather than serving the index directly, so the browser resolves the page's relative asset URLs against the directory instead of its parent.
    if (
      !isDirectoryUrl &&
      !isFile(filePath) &&
      isLinkFreeFile(join(filePath, DIRECTORY_INDEX)) &&
      !hasHiddenSegment(servedPath(config.root, join(filePath, DIRECTORY_INDEX), realPath))
    ) {
      return { status: 301, headers: { Location: directoryLocation(config.root, confined, request.url) }, body: null }
    }
    const stats = stat(filePath)
    // why: The stats above already refuse a link in the last segment, and the directories are tested last, so a path that answers 404 anyway is never walked.
    if (stats === null || !stats.isFile || passesThroughLink(config.root, dirname(filePath), isSymlink)) {
      return plainResponse(404, 'Not Found')
    }
    // why: A volume resolves spellings the text of a request does not show, such as a short name, so the names the file is stored under are judged before a byte or an entity tag of it is answered.
    if (hasHiddenSegment(storedFile(context, filePath, realPath).path)) {
      return plainResponse(404, 'Not Found')
    }
    context.filePath = filePath
    const etag = weakEtag(stats)
    if (etagMatches(request.headers['if-none-match'] as string | undefined, etag)) {
      return { status: 304, headers: { ETag: etag }, body: null }
    }
    const body = readFile(filePath)
    return {
      status: 200,
      headers: { 'Content-Type': contentTypeFor(filePath), 'Content-Length': String(body.length), ETag: etag },
      body,
    }
  }
}

/**
 * Builds the built-in serve pipeline, outermost step first: method guard,
 * compression, header rules, then the terminal file-serving step.
 *
 * Every answer the built-ins give carries the header rules that match it: the
 * method guard folds them over its own 405, and the header-rules step over
 * everything the file step answers. A 400, 403, 404 or 405 takes them without
 * the cache headers, and carries `Cache-Control: no-store` when a matching
 * rule names one; a 200, a 304 and a 301 take every one.
 *
 * Header rules sit inside compression so a rule's headers shape what the
 * compressor sees: a rule-set `Cache-Control: no-transform` suppresses
 * encoding and a rule-set `Content-Type` decides compressibility. Custom
 * steps prepend to this chain, so a plugin sees every request first and
 * every response last.
 *
 * @param config - The resolved serving plan.
 * @param deps - Injectable file-system boundaries.
 * @returns The ordered built-in steps.
 *
 * @example Assembling the default pipeline
 * ```typescript
 * const steps = buildServeSteps(resolved, {})
 * ```
 */
export function buildServeSteps(config: ResolvedServeConfig, deps: ServeStepDeps = {}): ServeStep[] {
  return [
    buildMethodGuard(config),
    compressionStep(deps.realPath ?? realPathOnDisk),
    buildHeaderRulesStep(config, deps),
    buildServeFileStep(config, deps),
  ]
}
