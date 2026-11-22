import type { HeaderPolicy, ServeHeaderRule } from './serve-types'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { embedders } from './embedders'
import { isRecord, refuse } from './issues'
import { permissionsPolicy } from './permissions-policy'
import { checkServeConfig, isolationRules } from './serve-config'

/** Response header names computed from the bytes on the wire; a header rule cannot set them. */
const PROTECTED_HEADERS: readonly string[] = ['content-length', 'content-encoding', 'etag']

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
 * Folds ordered header rules over a response's headers for one path.
 *
 * A rule applies when the path starts with its prefix and ends with its
 * suffix, an absent bound matching everything. Each header of an applying rule
 * replaces the header of the same name, compared without regard to case, so a
 * later rule overrides an earlier one a header at a time and no header is sent
 * under two spellings. A header keeps the position it first took. A rule's
 * `Content-Length`, `Content-Encoding` or `ETag` is skipped, since those
 * describe the body.
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
  const merged: Record<string, string> = { ...headers }
  for (const rule of rules.filter((candidate) => ruleMatches(candidate, path))) {
    for (const name of keys(rule.headers).filter((candidate) => !PROTECTED_HEADERS.includes(candidate.toLowerCase()))) {
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
