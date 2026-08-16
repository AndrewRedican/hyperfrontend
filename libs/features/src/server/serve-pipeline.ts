import type { IncomingHttpHeaders } from 'node:http'
import type { ResolvedServeConfig } from './serve-config'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The immutable view of one incoming request the serve pipeline reads. */
export interface StaticRequest {
  /** The HTTP method, uppercase. */
  readonly method: string
  /** The raw request URL, path plus query string. */
  readonly url: string
  /** The raw request headers. */
  readonly headers: IncomingHttpHeaders
}

/** The value a serve step returns: a complete response, ready to write. */
export interface StaticResponse {
  /** The HTTP status code. */
  readonly status: number
  /** Response headers by exact name. */
  readonly headers: Readonly<Record<string, string>>
  /** The response body, or `null` for a bodiless response. */
  readonly body: Buffer | null
}

/** Per-request state the steps share while a request runs through the pipeline. */
export interface ServeStepContext {
  /** The resolved serving plan. */
  readonly config: ResolvedServeConfig
  /** Absolute path of the file the terminal step resolved, recorded for path-matched header rules. */
  filePath?: string
}

/**
 * One link in the serve pipeline. A step may answer the request itself or
 * delegate to the rest of the pipeline with `next()` and transform what comes
 * back: the innermost step serves the file, so `next()` always yields a
 * complete response.
 */
export type ServeStep = (request: StaticRequest, context: ServeStepContext, next: () => StaticResponse) => StaticResponse

/**
 * Builds a plain-text response with the conventional minimal error shape.
 *
 * @param status - The HTTP status code.
 * @param text - The body text.
 * @returns The response value.
 *
 * @example Building a 404
 * ```typescript
 * plainResponse(404, 'Not Found')
 * ```
 */
export function plainResponse(status: number, text: string): StaticResponse {
  return { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from(text) }
}

/**
 * Reads a response header by case-insensitive name.
 *
 * @param headers - The response headers.
 * @param name - The header name to read, in any case.
 * @returns The header value, or `undefined` when absent.
 *
 * @example Reading a content type set in any case
 * ```typescript
 * headerValue({ 'content-type': 'text/html' }, 'Content-Type') // 'text/html'
 * ```
 */
export function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const wanted = name.toLowerCase()
  for (const key of keys(headers)) {
    if (key.toLowerCase() === wanted) {
      return headers[key]
    }
  }
  return undefined
}

/**
 * Runs a request through the pipeline, each step delegating inward via
 * `next()`. A pipeline whose steps all delegate past the end answers 404, so
 * a custom chain without a terminal step still returns a response.
 *
 * @param steps - The ordered steps, outermost first.
 * @param request - The request to answer.
 * @param context - The shared per-request context.
 * @returns The response the outermost step settled on.
 *
 * @example Running a request through a custom step and the built-ins
 * ```typescript
 * const response = runSteps([...customSteps, ...builtInSteps], request, { config })
 * ```
 */
export function runSteps(steps: readonly ServeStep[], request: StaticRequest, context: ServeStepContext): StaticResponse {
  const run = (index: number): StaticResponse => {
    const step = steps[index]
    if (step === undefined) {
      return plainResponse(404, 'Not Found')
    }
    return step(request, context, () => run(index + 1))
  }
  return run(0)
}
