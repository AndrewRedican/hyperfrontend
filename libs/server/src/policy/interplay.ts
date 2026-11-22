import type { PolicyIssue } from './issues'
import type { EmbedderSource, ServeHeaderRule } from './serve-types'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { frameAncestorsOf } from './content-security-policy'
import { checkEmbedders, frameAncestors } from './embedders'
import { policyIssue } from './issues'
import { checkPermissionsPolicy } from './permissions-policy'
import { matchesEveryPath } from './scope'

/** The fields of a header policy before any of them has been checked. */
export interface UncheckedHeaderPolicy {
  /** The candidate embedders list. */
  readonly embedders?: unknown
  /** The candidate permissions policy. */
  readonly permissionsPolicy?: unknown
  /** The candidate header rules. */
  readonly headers?: unknown
}

/**
 * Judges one authored policy header against the declared embedders.
 *
 * @param rule - The rule that sets the header.
 * @param path - Where the header sits, used to open the message.
 * @param policy - The header's value.
 * @param declared - The directive the declared embedders expand into.
 * @returns The problem, or `null` when the header keeps what the embedders declare on the paths the rule matches.
 */
function checkPolicyHeader(rule: ServeHeaderRule, path: string, policy: string, declared: string): PolicyIssue | null {
  const lists = frameAncestorsOf(policy)
  if (lists.length === 0) {
    return policyIssue(
      'embedders-dropped-by-rule',
      path,
      'replaces the policy "embedders" declares and has no frame-ancestors directive, so the paths it matches could be framed by any origin: add the directive to that value or remove "embedders".'
    )
  }
  // why: A bounded rule may scope a list of its own, but one that matches every path replaces the declared list everywhere, so a different list there would leave the field dead while still being published.
  if (!matchesEveryPath(rule) || lists.every((list) => ['frame-ancestors', ...list].join(' ') === declared)) {
    return null
  }
  // why: A rule that carries a bound which excludes nothing was already bounded by its author, so it is told which bounds would count instead of being told to add one.
  return policyIssue(
    'embedders-contradicted-by-rule',
    path,
    rule.prefix === undefined && rule.suffix === undefined
      ? 'applies to every path with a frame-ancestors list other than the one "embedders" declares: make the two equal, bound the rule with a prefix or suffix, or remove "embedders".'
      : 'applies to every path, because its prefix and suffix exclude none, with a frame-ancestors list other than the one "embedders" declares: make the two equal, give the rule a prefix longer than "/" or a suffix that is not empty, or remove "embedders".'
  )
}

/**
 * Checks the authored rules against the declared embedders. The fold replaces
 * a header's whole value and `frame-ancestors` has no fallback, so a rule that
 * sets `Content-Security-Policy` decides who may frame the paths it matches.
 *
 * @param sources - An embedders list that has already been accepted.
 * @param rules - Header rules that have already been accepted.
 * @returns One problem per rule that drops the directive, or that contradicts the list on every path.
 */
function checkEmbeddersAgainstRules(sources: readonly EmbedderSource[], rules: readonly ServeHeaderRule[]): readonly PolicyIssue[] {
  const declared = frameAncestors(sources)
  return rules.flatMap((rule, index) =>
    keys(rule.headers)
      // why: Header names compare without regard to case, and the report-only header enforces nothing, so only this one name is judged.
      .filter((name) => name.toLowerCase() === 'content-security-policy')
      .map((name) => checkPolicyHeader(rule, `headers[${index}].headers["${name}"]`, rule.headers[name] as string, declared))
      .filter((issue): issue is PolicyIssue => issue !== null)
  )
}

/**
 * Checks the two policy fields and then how the embedders sit with the rules,
 * in that order.
 *
 * @param policy - The fields as authored.
 * @param rulesSound - Whether the header rules have been accepted, which the comparison with the embedders needs.
 * @returns Every problem of `embedders`, then of `permissionsPolicy`, then of the rules against the embedders.
 *
 * @example Checking the policy fields of a config whose rules are sound
 * ```typescript
 * checkHeaderPolicy({ embedders: ["'self'"], permissionsPolicy: { camera: [] }, headers: [] }, true) // => []
 * ```
 */
export function checkHeaderPolicy(policy: UncheckedHeaderPolicy, rulesSound: boolean): readonly PolicyIssue[] {
  const embedderIssues = policy.embedders === undefined ? [] : checkEmbedders(policy.embedders)
  const comparable = policy.embedders !== undefined && embedderIssues.length === 0 && rulesSound
  return [
    ...embedderIssues,
    ...(policy.permissionsPolicy === undefined ? [] : checkPermissionsPolicy(policy.permissionsPolicy)),
    ...(comparable
      ? checkEmbeddersAgainstRules(policy.embedders as readonly EmbedderSource[], (policy.headers ?? []) as readonly ServeHeaderRule[])
      : []),
  ]
}
