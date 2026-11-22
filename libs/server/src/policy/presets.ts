import type { RuleScope, ServeHeaderRule } from './serve-types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { refuse } from './issues'
import { scopedRule, scopeProblems } from './scope'
import { ISOLATION_VALUES, isolationHeaders } from './serve-config'

/** A value the `Referrer-Policy` header takes. */
export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

/** What a {@link strictTransportSecurity} rule is built from. */
export interface StrictTransportSecurityOptions {
  /** How long, in whole seconds, a browser keeps to HTTPS for the host; zero retires the policy. */
  readonly maxAge: number
  /** Whether the policy covers every subdomain of the host as well. */
  readonly includeSubDomains?: boolean
  /** Whether the host asks to be built into browsers' preload lists, which needs the subdomains and a lifetime of a year or more. */
  readonly preload?: boolean
}

const REFERRER_POLICY_VALUES: readonly string[] = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
]

// note: One year in seconds: the shortest lifetime the browsers' preload lists accept, and the longest a cache is asked to keep an asset.
const ONE_YEAR = 31536000

/**
 * Builds the header rule that stops a browser from guessing a response's
 * content type: `X-Content-Type-Options: nosniff`.
 *
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When the scope is refused.
 *
 * @example Sending the header on every path
 * ```typescript
 * nosniff() // => { headers: { 'X-Content-Type-Options': 'nosniff' } }
 * ```
 */
export function nosniff(scope?: RuleScope): ServeHeaderRule {
  refuse(scopeProblems(scope))
  return scopedRule({ 'X-Content-Type-Options': 'nosniff' }, scope)
}

/**
 * Builds the header rule that limits what a request from the page tells the
 * next site about where it came from: one `Referrer-Policy` header.
 *
 * @param value - The policy; the origin alone on a cross-origin request when omitted.
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When the value is no policy token, or the scope is refused.
 *
 * @example Sending no referrer from a private area
 * ```typescript
 * referrerPolicy('no-referrer', { prefix: '/private/' })
 * // => { prefix: '/private/', headers: { 'Referrer-Policy': 'no-referrer' } }
 * ```
 */
export function referrerPolicy(value: ReferrerPolicyValue = 'strict-origin-when-cross-origin', scope?: RuleScope): ServeHeaderRule {
  refuse([
    ...(REFERRER_POLICY_VALUES.includes(value) ? [] : [`referrerPolicy: the value must be one of ${REFERRER_POLICY_VALUES.join(', ')}.`]),
    ...scopeProblems(scope),
  ])
  return scopedRule({ 'Referrer-Policy': value }, scope)
}

/**
 * Builds the header rule that tells a browser to reach the host over HTTPS
 * only: one `Strict-Transport-Security` header.
 *
 * The rule takes no scope, because a browser applies the header to the whole
 * host whichever response carried it. Send it only from a server reached over
 * HTTPS; a browser ignores it on plain HTTP.
 *
 * @param options - The lifetime, and whether subdomains and preloading are included.
 * @returns The rule, matching every path.
 * @throws {Error} When the lifetime is no whole number of seconds, or preloading is asked for without what it needs.
 *
 * @example Keeping a host and its subdomains on HTTPS for two years
 * ```typescript
 * strictTransportSecurity({ maxAge: 63072000, includeSubDomains: true, preload: true })
 * // => { headers: { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' } }
 * ```
 */
export function strictTransportSecurity(options: StrictTransportSecurityOptions): ServeHeaderRule {
  refuse([
    ...(isSafeInteger(options.maxAge) && options.maxAge >= 0
      ? []
      : ['strictTransportSecurity: maxAge must be a whole number of seconds, zero or more.']),
    ...(options.preload === true && (options.includeSubDomains !== true || options.maxAge < ONE_YEAR)
      ? [`strictTransportSecurity: preload needs includeSubDomains and a maxAge of at least ${ONE_YEAR}.`]
      : []),
  ])
  const directives = [
    `max-age=${options.maxAge}`,
    ...(options.includeSubDomains === true ? ['includeSubDomains'] : []),
    ...(options.preload === true ? ['preload'] : []),
  ]
  return { headers: { 'Strict-Transport-Security': directives.join('; ') } }
}

/**
 * Builds the header rule that lets a browser keep everything under a prefix
 * for a year without asking again: `Cache-Control: public, max-age=31536000,
 * immutable`. Use it for files whose name changes whenever their content does.
 *
 * @param prefix - The path the files sit under, such as `/assets/`.
 * @returns The rule, bounded by the prefix.
 * @throws {Error} When the prefix does not start with `/`, or is `/` alone and so would cover the pages too.
 *
 * @example Caching a build's hashed assets
 * ```typescript
 * immutableAssets('/assets/')
 * // => { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
 * ```
 */
export function immutableAssets(prefix: string): ServeHeaderRule {
  if (typeof prefix !== 'string' || !prefix.startsWith('/') || prefix.length < 2) {
    throw createError('immutableAssets: the prefix must start with "/" and name more than the whole site.')
  }
  return { prefix, headers: { 'Cache-Control': `public, max-age=${ONE_YEAR}, immutable` } }
}

/**
 * Builds the header rule that makes a document cross-origin isolated:
 * `Cross-Origin-Opener-Policy: same-origin`, the chosen
 * `Cross-Origin-Embedder-Policy`, and `Cross-Origin-Resource-Policy:
 * cross-origin`, which keeps the origin embeddable by hosts elsewhere.
 *
 * It writes the headers a config's `isolation` field expands into, and adds
 * the scope the field cannot carry.
 *
 * @param coep - The embedder policy that completes the isolation.
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When the value isolates nothing, or the scope is refused.
 *
 * @example Isolating one application of a site
 * ```typescript
 * crossOriginIsolation('credentialless', { prefix: '/app/' })
 * ```
 */
export function crossOriginIsolation(coep: 'require-corp' | 'credentialless', scope?: RuleScope): ServeHeaderRule {
  refuse([
    ...(ISOLATION_VALUES.includes(coep) ? [] : [`crossOriginIsolation: the value must be one of ${ISOLATION_VALUES.join(', ')}.`]),
    ...scopeProblems(scope),
  ])
  return scopedRule(isolationHeaders(coep), scope)
}
