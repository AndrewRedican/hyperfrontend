import type { ServeStep } from './serve-pipeline'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { headerValue } from './serve-pipeline'
import { contentTypeFor } from './static-handler'

// note: Bodies below this size gain nothing from compression; matches the compression default the `serve` package shipped with.
const COMPRESSION_THRESHOLD = 1024

// note: Brotli quality 4 trades ~q11 ratios for request-path speed; the same setting the `serve` package used.
const BROTLI_QUALITY = 4

/** One cached compression result, validated against the file's ETag before reuse. */
interface CompressedEntry {
  /** The ETag of the identity body the bytes were compressed from. */
  readonly etag: string
  /** The compressed bytes. */
  readonly bytes: Buffer
}

/**
 * Parses an `Accept-Encoding` header into the preferred supported encoding.
 *
 * Preference is brotli, then gzip — the order every mainstream browser also
 * ranks them in. A `*` token stands in for both. Encodings disabled with
 * `q=0` are never chosen.
 *
 * @param header - The raw `Accept-Encoding` value.
 * @returns `'br'`, `'gzip'`, or `null` when neither is acceptable.
 *
 * @example Negotiating a browser's default header
 * ```typescript
 * negotiateEncoding('gzip, deflate, br') // 'br'
 * ```
 */
export function negotiateEncoding(header: string | undefined): 'br' | 'gzip' | null {
  if (header === undefined) {
    return null
  }
  const quality: Record<string, number> = {}
  for (const token of header.split(',')) {
    const parts = token.trim().split(';')
    // why: `split` always yields a first element, so the index type's `undefined` is asserted away rather than branched on.
    const name = (<string>parts[0]).trim().toLowerCase()
    if (name === '') {
      continue
    }
    let q = 1
    for (const param of parts.slice(1)) {
      const [key, value] = param.trim().split('=')
      // why: `split` always yields a first element, and the quality parameter name is case-insensitive per RFC 9110.
      if ((<string>key).toLowerCase() === 'q' && value !== undefined) {
        q = Number(value)
      }
    }
    quality[name] = q
  }
  const wildcard = quality['*']
  const qualityOf = (name: string): number => {
    const own = quality[name]
    if (own !== undefined) {
      return own
    }
    return wildcard !== undefined ? wildcard : 0
  }
  if (qualityOf('br') > 0) {
    return 'br'
  }
  return qualityOf('gzip') > 0 ? 'gzip' : null
}

/**
 * Reports whether a content type gains from compression.
 *
 * @param contentType - The response's content type.
 * @returns `true` for text-based types.
 */
function isCompressible(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('javascript') ||
    contentType.includes('json') ||
    contentType.includes('svg') ||
    contentType.includes('xml')
  )
}

/**
 * Merges `Accept-Encoding` into a response's `Vary` header without dropping
 * what a header rule already put there.
 *
 * @param headers - The response headers.
 * @returns The headers with `Vary` covering `Accept-Encoding`.
 */
function withVary(headers: Readonly<Record<string, string>>): Record<string, string> {
  const varyKey = keys(headers).find((key) => key.toLowerCase() === 'vary')
  if (varyKey === undefined) {
    return { ...headers, Vary: 'Accept-Encoding' }
  }
  const existing = <string>headers[varyKey]
  if (existing.toLowerCase().includes('accept-encoding')) {
    return { ...headers }
  }
  return { ...headers, [varyKey]: `${existing}, Accept-Encoding` }
}

/**
 * Builds the compression step: 200-status text responses at or above the
 * threshold are brotli- or gzip-encoded per the client's `Accept-Encoding`,
 * with compressed bytes cached per file so a static deployment compresses
 * each asset once per encoding.
 *
 * HEAD requests skip compression so their advertised `Content-Length` stays
 * the identity size, and a `Cache-Control: no-transform` set by a header rule
 * is honored. Bodiless answers for compressible resources (HEAD, 304) still
 * carry `Vary: Accept-Encoding` so caches keep encodings apart.
 *
 * @returns A step that encodes eligible response bodies.
 *
 * @example Composing the step into a custom pipeline
 * ```typescript
 * const steps = [buildCompressionStep(), terminalStep]
 * ```
 */
export function buildCompressionStep(): ServeStep {
  const cache = createMap<string, CompressedEntry>()
  return (request, context, next) => {
    const response = next()
    if (request.method === 'HEAD' || response.status === 304) {
      // why: The variant a GET of this resource would negotiate depends on Accept-Encoding, so the bodiless answers advertise it too — a cache keying only on the path must not fold encodings together.
      const bodilessType =
        headerValue(response.headers, 'Content-Type') ?? (context.filePath === undefined ? '' : contentTypeFor(context.filePath))
      return isCompressible(bodilessType) ? { ...response, headers: withVary(response.headers) } : response
    }
    if (response.status !== 200 || response.body === null) {
      return response
    }
    const contentType = headerValue(response.headers, 'Content-Type') ?? ''
    if (!isCompressible(contentType)) {
      return response
    }
    const cacheControl = headerValue(response.headers, 'Cache-Control') ?? ''
    if (cacheControl.toLowerCase().includes('no-transform')) {
      return response
    }
    // why: Sub-threshold responses still advertise Vary so a cache never serves the small identity answer to a client that would have negotiated differently on a larger one.
    if (response.body.length < COMPRESSION_THRESHOLD) {
      return { ...response, headers: withVary(response.headers) }
    }
    const encoding = negotiateEncoding(<string | undefined>request.headers['accept-encoding'])
    if (encoding === null) {
      return { ...response, headers: withVary(response.headers) }
    }
    const etag = headerValue(response.headers, 'ETag')
    // why: The cache is keyed by file and validated by ETag, so a response without both is compressed fresh — a changed file can never serve stale bytes.
    const cacheKey = context.filePath === undefined || etag === undefined ? null : `${context.filePath}|${encoding}`
    const cached = cacheKey === null ? undefined : cache.get(cacheKey)
    const bytes =
      cached !== undefined && cached.etag === etag
        ? cached.bytes
        : encoding === 'br'
          ? brotliCompressSync(response.body, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
          : gzipSync(response.body)
    if (cacheKey !== null && (cached === undefined || cached.etag !== etag)) {
      // why: A non-null cache key is only ever built from a defined etag, so the assertion restates what the key construction guarantees.
      cache.set(cacheKey, { etag: <string>etag, bytes })
    }
    const headers: Record<string, string> = { ...withVary(response.headers), 'Content-Encoding': encoding }
    const lengthKey = keys(headers).find((key) => key.toLowerCase() === 'content-length')
    if (lengthKey !== undefined) {
      headers[lengthKey] = String(bytes.length)
    }
    return { ...response, headers, body: bytes }
  }
}
