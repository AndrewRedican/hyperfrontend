import type { FileStats } from '@hyperfrontend/project-scope/core/fs'
import type { ServeHeaderRule } from '../shared/serve-types'
import type { ResolvedServeConfig } from './serve-config'
import type { ServeStep, ServeStepContext, StaticRequest, StaticResponse } from './serve-pipeline'
import { join, relative, sep } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getFileStat, isFile as isFileOnDisk, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'
import { buildCompressionStep } from './serve-compression'
import { plainResponse } from './serve-pipeline'
import { confineDecodedPath, contentTypeFor, decodeRequestPath, directoryLocation, requestPath } from './static-handler'

// note: File a directory URL resolves to, matching the dev server and common static hosts.
const DIRECTORY_INDEX = 'index.html'

// note: The artifact-carried config never serves; it configures the server and is not site content.
const CONFIG_PREFIX = 'hf-serve.config.'

/** Response header names the built-in pipeline owns; header rules cannot override them. */
const PROTECTED_HEADERS: readonly string[] = ['content-length', 'content-encoding', 'etag']

/** Injectable file-system boundaries for the built-in serve steps, defaulted for production. */
export interface ServeStepDeps {
  /** Reads a file's bytes. */
  readonly readFile?: (filePath: string) => Buffer
  /** Reports whether a path is a readable file. */
  readonly isFile?: (filePath: string) => boolean
  /** Reads a file's stats, or `null` when the path is unreadable. */
  readonly stat?: (filePath: string) => FileStats | null
}

/**
 * Answers non-GET/HEAD methods with 405 so the static pipeline only ever
 * reads the site.
 *
 * @param request - The request to gate.
 * @param _context - Unused shared context.
 * @param next - The rest of the pipeline.
 * @returns A 405 for a write method, the pipeline's response otherwise.
 */
function methodGuard(request: StaticRequest, _context: ServeStepContext, next: () => StaticResponse): StaticResponse {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return { ...plainResponse(405, 'Method Not Allowed'), headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' } }
  }
  return next()
}

/**
 * Reports whether one header rule matches a request's path.
 *
 * @param rule - The rule whose optional prefix and suffix bound the match.
 * @param path - The path the rule is tested against.
 * @returns `true` when both bounds (where given) match.
 */
function ruleMatches(rule: ServeHeaderRule, path: string): boolean {
  const prefixOk = rule.prefix === undefined || path.startsWith(rule.prefix)
  const suffixOk = rule.suffix === undefined || path.endsWith(rule.suffix)
  return prefixOk && suffixOk
}

/**
 * Builds the step that applies the config's ordered header rules onto every
 * response, later rules overriding earlier ones one header at a time.
 *
 * Rules match against the resolved file's root-relative path when the request
 * reached a file (so `suffix: '.html'` covers a directory URL's `index.html`),
 * and against the request path otherwise.
 *
 * @param config - The resolved serving plan carrying the rules.
 * @returns A step that rewrites matching responses' headers.
 */
function buildHeaderRulesStep(config: ResolvedServeConfig): ServeStep {
  return (request, context, next) => {
    const response = next()
    if (config.headers.length === 0) {
      return response
    }
    const resolved = context.filePath === undefined ? undefined : `/${relative(config.root, context.filePath).split(sep).join('/')}`
    const path = resolved ?? requestPath(request.url)
    const merged: Record<string, string> = { ...response.headers }
    for (const rule of config.headers) {
      if (!ruleMatches(rule, path)) {
        continue
      }
      for (const name of keys(rule.headers)) {
        if (PROTECTED_HEADERS.includes(name.toLowerCase())) {
          continue
        }
        // why: A rule spelled in a different case must replace the existing header, not sit beside it — a record with both keys makes the pipeline read one value while the wire carries the other.
        const existing = keys(merged).find((key) => key.toLowerCase() === name.toLowerCase())
        if (existing !== undefined && existing !== name) {
          delete merged[existing]
        }
        merged[name] = <string>rule.headers[name]
      }
    }
    return { ...response, headers: merged }
  }
}

/**
 * Computes a weak ETag from a file's size and modification time — enough to
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
 * Reports whether a decoded path contains a segment the server never serves:
 * dotfiles (excluding the `.`/`..` navigation segments the resolver handles)
 * and the artifact-carried config file.
 *
 * @param decoded - The percent-decoded request path.
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
 * answers conditional requests with 304, and serves the file bytes. Symlinked
 * paths answer 404.
 *
 * @param config - The resolved serving plan.
 * @param deps - Injectable file-system boundaries.
 * @returns The file-serving step; it never calls `next`.
 */
function buildServeFileStep(config: ResolvedServeConfig, deps: ServeStepDeps): ServeStep {
  const readFile = deps.readFile ?? readFileBuffer
  const isFile = deps.isFile ?? isFileOnDisk
  // why: Stats come from lstat so a symlink reports itself instead of its target — the textual root confinement cannot follow a link out of the site, and a symlinked path answers 404, matching the serve package's default.
  const stat = deps.stat ?? ((filePath: string) => getFileStat(filePath, false))
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
    if (!isDirectoryUrl && !isFile(filePath) && isFile(join(filePath, DIRECTORY_INDEX))) {
      return { status: 301, headers: { Location: directoryLocation(config.root, confined, request.url) }, body: null }
    }
    const stats = stat(filePath)
    if (stats === null || !stats.isFile) {
      return plainResponse(404, 'Not Found')
    }
    context.filePath = filePath
    const etag = weakEtag(stats)
    if (etagMatches(<string | undefined>request.headers['if-none-match'], etag)) {
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
 * Header rules sit inside compression so a rule's headers shape what the
 * compressor sees — a rule-set `Cache-Control: no-transform` suppresses
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
  return [methodGuard, buildCompressionStep(), buildHeaderRulesStep(config), buildServeFileStep(config, deps)]
}
