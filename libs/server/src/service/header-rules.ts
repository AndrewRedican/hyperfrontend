import type { ServeHeaderRule } from '../policy/serve-types'
import type { ServiceResponse, Step } from './contract'
import { freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { applyFailureHeaderRules, applyHeaderRules } from '../policy/expand'
import { validateHeaderRule } from '../policy/serve-config'

/**
 * Reports whether a response is a failure nothing may store: a status of 400 or above with a `Cache-Control` that is exactly `no-store`,
 * which is how the kernel renders every failure. A response a handler built with the same two marks is treated alike, and that costs it only a lifetime it had refused itself.
 *
 * @param response - The response on its way out through the step.
 * @returns `true` when no rule may give the response a lifetime in a cache.
 */
function isUnstoredFailure(response: ServiceResponse): boolean {
  const name = keys(response.headers).find((key) => key.toLowerCase() === 'cache-control')
  return response.status >= 400 && name !== undefined && response.headers[name] === 'no-store'
}

/**
 * Applies ordered header rules to every response that passes through it, failures included, matched against the canonical request path; later rules win one header at a time. Throws at construction for a rule the policy entry's validator refuses.
 * A rule's header replaces the header of the same name in any spelling. `Content-Length`, `Content-Encoding`, `ETag`, `Transfer-Encoding` and `Trailer` are never set by a rule,
 * and neither are `Connection`, `Keep-Alive`, `Upgrade` and `TE`, which belong to the connection: a rule that names one is accepted and that header is left out, as the static server leaves it out.
 * The status, the cookies and the body pass through untouched. Responses written outside the pipeline, such as the 400 for a refused target, are not reached.
 * A failure nothing may store stays that way: a response with a status of 400 or above whose `Cache-Control` is exactly `no-store`, which is how every failure the kernel renders leaves it,
 * keeps that header and takes no `Expires`, `Surrogate-Control`, `X-Accel-Expires` or header ending in `-Cache-Control` from a rule. It takes every other header of a matching rule.
 *
 * @param rules - The rules, in the order they are applied; a rule matches a path that starts with its `prefix` and ends with its `suffix`.
 * @returns The step. Place it outside the steps whose responses it should mark.
 * @throws {Error} For the first faulty rule, one line per problem, each starting with `headerRules: `.
 *
 * @example Sending routed responses the headers a preset declares
 * ```typescript
 * import { headerRules, jsonResponse, route, router, startService } from '@hyperfrontend/server'
 *
 * const hardened = headerRules([
 *   { headers: { 'X-Content-Type-Options': 'nosniff' } },
 *   { prefix: '/reports/', headers: { 'Cache-Control': 'private, no-store' } },
 * ])
 * const api = router({ 'reports.read': route('GET', '/reports/:id', (request) => jsonResponse(200, { id: request.params.id })) })
 * const service = await startService({ port: 8080, steps: [hardened, api] })
 * // GET /reports/7 carries X-Content-Type-Options: nosniff and Cache-Control: private, no-store
 * // GET /nothing answers 404 and carries X-Content-Type-Options: nosniff too
 * ```
 *
 * @example Writing a lifetime for every path without making a failure cacheable
 * ```typescript
 * import { headerRules, jsonResponse, route, router, startService } from '@hyperfrontend/server'
 *
 * const cached = headerRules([{ headers: { 'Cache-Control': 'max-age=600', 'X-Frame-Options': 'DENY' } }])
 * const api = router({ 'prices.list': route('GET', '/prices', () => jsonResponse(200, { prices: [] })) })
 * const service = await startService({ port: 8080, steps: [cached, api] })
 * // GET /prices answers 200 with Cache-Control: max-age=600 and X-Frame-Options: DENY
 * // GET /nothing answers 404 with Cache-Control: no-store and X-Frame-Options: DENY
 * ```
 */
export function headerRules(rules: readonly ServeHeaderRule[]): Step {
  // how: spreading turns a hole into `undefined`, which the validator refuses, where a plain walk would skip it
  const validated = freeze([...rules].map((rule, index) => validateHeaderRule(rule, index, 'headerRules')))
  return (request, _context, next) =>
    next().then((response) => ({
      ...response,
      headers: (isUnstoredFailure(response) ? applyFailureHeaderRules : applyHeaderRules)(validated, request.path, response.headers),
    }))
}
