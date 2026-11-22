import type { HeaderPolicy, ServeHeaderRule } from './serve-types'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { embedders } from './embedders'
import { isRecord, refuse } from './issues'
import { permissionsPolicy } from './permissions-policy'
import { checkServeConfig, isolationRules } from './serve-config'

/** Response header names the server owns, since they describe the bytes on the wire, how the body is framed or the connection it travels on; a header rule cannot set them. */
const PROTECTED_HEADERS: readonly string[] = [
  'content-length',
  'content-encoding',
  'etag',
  'transfer-encoding',
  'trailer',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
]

// note: Folded last over the answer to a failure, so no cache keeps a fault under a lifetime a rule wrote for a page or a file.
const NEVER_STORED: ServeHeaderRule = { headers: { 'Cache-Control': 'no-store' } }

// note: Headers besides Cache-Control that give a response a lifetime in a cache: Expires for a cache that reads no Cache-Control, the other two for a proxy that ranks them above it.
const LIFETIME_HEADERS: readonly string[] = ['expires', 'surrogate-control', 'x-accel-expires']

/**
 * Lists what is wrong with a header policy, in the sentences a serve config
 * with the same fields is refused with.
 *
 * @param policy - The value handed over as a policy, which no validator need have seen.
 * @returns One sentence per problem of `isolation`, the rules, `embedders`, `permissionsPolicy` and the rules against the embedders.
 */
function policyProblems(policy: unknown): readonly string[] {
  if (!isRecord(policy)) {
    return ['header policy must be an object.']
  }
  // why: Only the four policy fields are judged, so a whole serve config can be handed over without its other fields being read here.
  return checkServeConfig({
    isolation: policy['isolation'],
    embedders: policy['embedders'],
    permissionsPolicy: policy['permissionsPolicy'],
    headers: policy['headers'],
  }).map((issue) => issue.message)
}

/**
 * Expands a header policy into the ordered rules a server folds over each
 * response: the rule for `embedders`, the rule for `permissionsPolicy`, the
 * rule for `isolation`, then the authored rules. Each declared field becomes
 * one rule that matches every path, and an empty permissions policy becomes
 * none.
 *
 * The declared fields lead so that an authored rule still overrides any header
 * they set. The one thing an authored rule may not do is undo the embedders: a
 * rule that sets `Content-Security-Policy` without a `frame-ancestors`
 * directive, or an unbounded rule whose directive lists other sources, is
 * refused.
 *
 * The four fields are checked the way a serve config's are, so a policy that
 * never passed a validator is refused here with the same sentences and no
 * rule is built from it. Any other field of the value is left unread.
 *
 * @param policy - The policy fields of a serve config.
 * @returns The rules, in the order they are applied.
 * @throws {Error} When the value is no object, a field or a rule is refused, or a rule undoes the embedders, with one line per problem.
 *
 * @example Expanding the policy of a page one host may frame
 * ```typescript
 * expandHeaderPolicy({ embedders: ['https://host.example'], isolation: 'require-corp' })
 * // => [
 * //   { headers: { 'Content-Security-Policy': 'frame-ancestors https://host.example' } },
 * //   { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'cross-origin' } },
 * // ]
 * ```
 */
export function expandHeaderPolicy(policy: HeaderPolicy): readonly ServeHeaderRule[] {
  refuse(policyProblems(policy))
  return [
    ...(policy.embedders === undefined ? [] : [embedders(policy.embedders)]),
    // why: A rule that sets no header would only be noise in the plan a server prints or publishes.
    ...[permissionsPolicy(policy.permissionsPolicy ?? {})].filter((rule) => keys(rule.headers).length > 0),
    ...isolationRules(policy.isolation),
    ...(policy.headers ?? []),
  ]
}

/**
 * Reports whether one header rule matches a path.
 *
 * @param rule - The rule whose optional prefix and suffix bound the match.
 * @param path - The path the rule is tested against.
 * @returns `true` when both bounds (where given) match.
 */
function ruleMatches(rule: ServeHeaderRule, path: string): boolean {
  return (rule.prefix === undefined || path.startsWith(rule.prefix)) && (rule.suffix === undefined || path.endsWith(rule.suffix))
}

/**
 * Reports whether a rule may set a header at all: every header but the ones
 * the server owns.
 *
 * @param name - The header name, in any letter case.
 * @returns `false` for a header that describes the bytes on the wire, how the body is framed or the connection.
 */
function isSettable(name: string): boolean {
  return !PROTECTED_HEADERS.includes(name.toLowerCase())
}

/**
 * Reports whether a header other than `Cache-Control` gives a response a
 * lifetime in a cache: `Expires`, `Surrogate-Control`, `X-Accel-Expires`, and
 * the cache control fields targeted at one class of cache, such as
 * `CDN-Cache-Control`.
 *
 * @param name - The header name, in any letter case.
 * @returns `true` when no rule may put the header on the answer to a failure.
 */
function setsLifetime(name: string): boolean {
  const lowered = name.toLowerCase()
  return LIFETIME_HEADERS.includes(lowered) || lowered.endsWith('-cache-control')
}

/**
 * Folds the rules that match a path over a header record, taking from each
 * rule only the headers a test lets through.
 *
 * @param rules - The rules, in the order they are applied.
 * @param path - The path being answered.
 * @param headers - The headers the response already carries.
 * @param taken - Tells whether a rule may set the header of a given name.
 * @returns A new header record; the one passed in is left as it was.
 */
function fold(
  rules: readonly ServeHeaderRule[],
  path: string,
  headers: Readonly<Record<string, string>>,
  taken: (name: string) => boolean
): Record<string, string> {
  const merged: Record<string, string> = { ...headers }
  for (const rule of rules.filter((candidate) => ruleMatches(candidate, path))) {
    for (const name of keys(rule.headers).filter(taken)) {
      // why: A rule spelled in a different case must replace the existing header, not sit beside it: a record with both keys makes the pipeline read one value while the wire carries the other.
      const existing = keys(merged).find((key) => key.toLowerCase() === name.toLowerCase())
      if (existing !== undefined && existing !== name) {
        delete merged[existing]
      }
      merged[name] = rule.headers[name] as string
    }
  }
  return merged
}

/**
 * Folds ordered header rules over a response's headers for one path.
 *
 * A rule applies when the path starts with its prefix and ends with its
 * suffix, an absent bound matching everything. Each header of an applying rule
 * replaces the header of the same name, compared without regard to case, so a
 * later rule overrides an earlier one a header at a time and no header is sent
 * under two spellings. A header keeps the position it first took. A rule's
 * `Content-Length`, `Content-Encoding` or `ETag` is skipped, since those
 * describe the body, and so is its `Transfer-Encoding` or `Trailer`, since the
 * server frames the body itself and sends no trailer. Its `Connection`,
 * `Keep-Alive`, `Upgrade` or `TE` is skipped too: whether a connection is kept
 * or closed is the server's to say, one response at a time, and a path cannot
 * decide it.
 *
 * @param rules - The rules, in the order they are applied.
 * @param path - The path being answered, starting with `/`.
 * @param headers - The headers the response already carries; none when omitted.
 * @returns A new header record; the one passed in is left as it was.
 *
 * @example Reading what a page and an asset are sent
 * ```typescript
 * const rules = [{ headers: { 'Cache-Control': 'no-cache' } }, { prefix: '/assets/', headers: { 'Cache-Control': 'immutable' } }]
 * applyHeaderRules(rules, '/index.html') // => { 'Cache-Control': 'no-cache' }
 * applyHeaderRules(rules, '/assets/app.js') // => { 'Cache-Control': 'immutable' }
 * ```
 */
export function applyHeaderRules(
  rules: readonly ServeHeaderRule[],
  path: string,
  headers: Readonly<Record<string, string>> = {}
): Record<string, string> {
  return fold(rules, path, headers, isSettable)
}

/**
 * Reports whether a header says how a cache may keep a response:
 * `Cache-Control` and every header that gives a response a lifetime.
 *
 * @param name - The header name, in any letter case.
 * @returns `true` when a rule naming the header has spoken about caching.
 */
function namesCaching(name: string): boolean {
  return name.toLowerCase() === 'cache-control' || setsLifetime(name)
}

/**
 * Folds ordered header rules over the headers of an answer with an error
 * status, which takes no cache header of a rule as written.
 *
 * The fold is the one every response gets, with one difference. When a rule
 * that matches the path names `Cache-Control`, `Expires`, `Surrogate-Control`,
 * `X-Accel-Expires` or any header whose name ends with `-Cache-Control`, the
 * answer is folded as a failure is: those headers are skipped and
 * `Cache-Control: no-store` is written in the place the header first took. A
 * lifetime written for a file therefore never reaches the refusal answered in
 * its place, and a rule that forbids caching is never loosened for it. When no
 * matching rule names one, the answer is given no cache header. Every other
 * header of a matching rule is taken either way, so an error is framed and
 * sniffed under the same policy as a success.
 *
 * @param rules - The rules, in the order they are applied.
 * @param path - The path being answered, starting with `/`.
 * @param headers - The headers the answer already carries.
 * @returns A new header record; the one passed in is left as it was.
 *
 * @example Answering a missing file under a rule written for hashed assets
 * ```typescript
 * const assets = { prefix: '/assets/', headers: { 'Cache-Control': 'max-age=31536000', 'CDN-Cache-Control': 'max-age=31536000' } }
 * const framing = { headers: { 'X-Frame-Options': 'DENY' } }
 * applyErrorHeaderRules([framing, assets], '/assets/app.js', { 'Content-Type': 'text/plain; charset=utf-8' })
 * // => { 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }
 * applyErrorHeaderRules([framing, assets], '/missing.html', { 'Content-Type': 'text/plain; charset=utf-8' })
 * // => { 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY' }
 * ```
 */
export function applyErrorHeaderRules(
  rules: readonly ServeHeaderRule[],
  path: string,
  headers: Readonly<Record<string, string>>
): Record<string, string> {
  // why: A plan that says nothing about caching for the path keeps its errors as they were, with no cache header at all.
  const spoken = rules.some((rule) => ruleMatches(rule, path) && keys(rule.headers).some(namesCaching))
  return spoken ? applyFailureHeaderRules(rules, path, headers) : fold(rules, path, headers, isSettable)
}

/**
 * Folds ordered header rules over the headers of a failure, which nothing may
 * store under a lifetime a rule wrote for a page or a file.
 *
 * The fold is the one every response gets, with two differences. No rule
 * gives the failure a lifetime in a cache: a rule's `Expires`,
 * `Surrogate-Control`, `X-Accel-Expires` and any header whose name ends with
 * `-Cache-Control` are skipped, each of which some cache goes by instead of
 * `Cache-Control`. And `Cache-Control: no-store` is written last, in the place
 * the header first took, whatever a rule set. Every other header of a matching
 * rule is taken, so a failure is framed and sniffed under the same policy as
 * a success. A lifetime header the failure carried itself is left as it was.
 *
 * An answer with a status of 400 or above that is no failure of the server is
 * folded this way too, once a matching rule has named a cache header.
 *
 * @param rules - The rules, in the order they are applied.
 * @param path - The path being answered, starting with `/`.
 * @param headers - The headers the failure already carries.
 * @returns A new header record; the one passed in is left as it was.
 *
 * @example Answering a fault under a rule written for hashed assets
 * ```typescript
 * const assets = { prefix: '/assets/', headers: { 'Cache-Control': 'max-age=31536000', 'CDN-Cache-Control': 'max-age=31536000' } }
 * const framing = { headers: { 'X-Frame-Options': 'DENY' } }
 * applyFailureHeaderRules([framing, assets], '/assets/app.js', { 'Content-Type': 'text/plain; charset=utf-8' })
 * // => { 'Content-Type': 'text/plain; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }
 * ```
 */
export function applyFailureHeaderRules(
  rules: readonly ServeHeaderRule[],
  path: string,
  headers: Readonly<Record<string, string>>
): Record<string, string> {
  return fold([...rules, NEVER_STORED], path, headers, (name) => isSettable(name) && !setsLifetime(name))
}
