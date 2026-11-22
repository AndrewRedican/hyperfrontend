import type { PolicyIssue } from './issues'
import type { RuleScope, ServeHeaderRule } from './serve-types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isRecord, policyIssue, refuse } from './issues'
import { scopedRule, scopeProblems } from './scope'
import { classifyHostSource } from './source'

// note: A subset of the structured-field key grammar, which is what every feature name a browser knows is written in.
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/

/**
 * Finds what is wrong with one entry of a feature's allowlist.
 *
 * @param entry - The entry as authored.
 * @param path - Where the entry sits, used to open the message.
 * @param alone - Whether the entry is the only one of its allowlist.
 * @returns The problem the entry has, or `null` when it is `self`, a lone `*` or an origin.
 */
function checkAllowlistEntry(entry: unknown, path: string, alone: boolean): PolicyIssue | null {
  if (typeof entry !== 'string') {
    return policyIssue('permissions-policy-entry-not-string', path, 'must be a string.')
  }
  if (entry === '*') {
    return alone ? null : policyIssue('permissions-policy-wildcard-not-alone', path, 'is "*", which must be the only entry.')
  }
  if (entry === 'self') {
    return null
  }
  if (entry.startsWith("'") || entry.startsWith('"')) {
    return policyIssue(
      'permissions-policy-keyword-quoted',
      path,
      "is quoted: write self without quotes, and an empty array in place of 'none'."
    )
  }
  // why: The host-source grammar is anchored and lowercase ASCII, so it alone refuses a separator, a space, a control character or a capital.
  return classifyHostSource(entry) === 'ok'
    ? null
    : policyIssue(
        'permissions-policy-origin-invalid',
        path,
        'is not an origin: expected self, "*" or scheme://host with an optional port, in lowercase ASCII with no path.'
      )
}

/**
 * Finds what is wrong with one feature of a permissions policy.
 *
 * @param name - The feature name as authored.
 * @param allowlist - The value authored for the feature.
 * @returns The feature's problems: one for a refused name or a value that is no array, otherwise one per refused entry.
 */
function checkFeature(name: string, allowlist: unknown): readonly PolicyIssue[] {
  const path = `permissionsPolicy[${stringify(name)}]`
  if (!FEATURE_NAME.test(name)) {
    return [
      policyIssue(
        'permissions-policy-name-invalid',
        path,
        'is not a feature name: use lowercase letters, digits and hyphens, starting with a letter.'
      ),
    ]
  }
  if (!isArray(allowlist)) {
    return [
      policyIssue(
        'permissions-policy-allowlist-not-array',
        path,
        'must be an array: [] disables the feature, ["self"] keeps it for this origin, ["*"] allows every origin.'
      ),
    ]
  }
  // why: A hole is walked like any entry, so an allowlist a doubled comma left sparse is refused instead of being written with an empty slot.
  return from(allowlist, (entry: unknown, index) => checkAllowlistEntry(entry, `${path}[${index}]`, allowlist.length === 1)).filter(
    (issue): issue is PolicyIssue => issue !== null
  )
}

/**
 * Checks a value as the `permissionsPolicy` field of a serve config: for each
 * browser feature, the origins allowed to use it in the documents the server
 * sends.
 *
 * A feature name is lowercase letters, digits and hyphens. Its allowlist is an
 * array of `self`, `*` as the only entry, or `scheme://host` origins; an empty
 * array disables the feature. A name no browser knows is accepted, since
 * browsers ignore it.
 *
 * @param value - The candidate record.
 * @returns Every problem found, in authored order; empty when the record is sound.
 *
 * @example Checking a record before it is published
 * ```typescript
 * checkPermissionsPolicy({ camera: [], geolocation: ['self'] }) // => []
 * checkPermissionsPolicy({ camera: ["'self'"] }).map((issue) => issue.code) // => ['permissions-policy-keyword-quoted']
 * ```
 */
export function checkPermissionsPolicy(value: unknown): readonly PolicyIssue[] {
  if (!isRecord(value)) {
    return [
      {
        code: 'permissions-policy-not-object',
        path: 'permissionsPolicy',
        message: '"permissionsPolicy" must be an object of feature names to allowlists.',
      },
    ]
  }
  return keys(value).flatMap((name) => checkFeature(name, value[name]))
}

/**
 * Writes one member of the header: the feature and the origins it is allowed for.
 *
 * @param name - The feature the member is written for.
 * @param allowlist - An allowlist {@link checkPermissionsPolicy} accepts.
 * @returns `name=*` for every origin, otherwise `name=(...)` with `self` bare and each origin in double quotes.
 */
function serialiseFeature(name: string, allowlist: readonly string[]): string {
  if (allowlist.length === 1 && allowlist[0] === '*') {
    return `${name}=*`
  }
  return `${name}=(${allowlist.map((entry) => (entry === 'self' ? 'self' : `"${entry}"`)).join(' ')})`
}

/**
 * Builds the header rule that restricts which browser features a document may
 * use: one `Permissions-Policy` header listing the features in the order the
 * record gives them. An empty record builds a rule that sets no header.
 *
 * @param features - For each feature, the origins allowed to use it; an empty array disables the feature.
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When a feature or the scope is refused, with one line per problem.
 *
 * @example Disabling the camera and keeping geolocation for this origin
 * ```typescript
 * permissionsPolicy({ camera: [], geolocation: ['self'] })
 * // => { headers: { 'Permissions-Policy': 'camera=(), geolocation=(self)' } }
 * ```
 */
export function permissionsPolicy(features: Readonly<Record<string, readonly string[]>>, scope?: RuleScope): ServeHeaderRule {
  refuse([...checkPermissionsPolicy(features).map((issue) => issue.message), ...scopeProblems(scope)])
  const value = keys(features)
    .map((name) => serialiseFeature(name, features[name] as readonly string[]))
    .join(', ')
  return scopedRule(value === '' ? {} : { 'Permissions-Policy': value }, scope)
}
