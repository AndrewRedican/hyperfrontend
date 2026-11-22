import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** What kind of problem a {@link PolicyIssue} reports, stable across releases so a tool can branch on it. */
export type PolicyIssueCode =
  | 'config-not-object'
  | 'root-invalid'
  | 'port-invalid'
  | 'host-invalid'
  | 'log-invalid'
  | 'isolation-invalid'
  | 'headers-not-array'
  | 'rule-not-object'
  | 'rule-prefix-invalid'
  | 'rule-suffix-invalid'
  | 'rule-headers-not-object'
  | 'header-name-invalid'
  | 'header-value-not-string'
  | 'header-value-control-character'
  | 'header-value-not-latin1'
  | 'embedders-not-array'
  | 'embedder-not-string'
  | 'embedder-empty'
  | 'embedder-control-character'
  | 'embedder-separator'
  | 'embedder-whitespace'
  | 'embedder-not-ascii'
  | 'embedder-not-lowercase'
  | 'embedder-none-not-alone'
  | 'embedder-keyword-unquoted'
  | 'embedder-keyword-unknown'
  | 'embedder-permits-every-origin'
  | 'embedder-scheme-missing'
  | 'embedder-has-path'
  | 'embedder-port-invalid'
  | 'embedder-wildcard-too-broad'
  | 'embedder-malformed'
  | 'embedders-dropped-by-rule'
  | 'embedders-contradicted-by-rule'
  | 'permissions-policy-not-object'
  | 'permissions-policy-name-invalid'
  | 'permissions-policy-allowlist-not-array'
  | 'permissions-policy-entry-not-string'
  | 'permissions-policy-wildcard-not-alone'
  | 'permissions-policy-keyword-quoted'
  | 'permissions-policy-origin-invalid'
  | 'unknown-field'
  | 'rule-unknown-field'

/** One problem found in a serve config, located and worded for the person who wrote the config. */
export interface PolicyIssue {
  /** The kind of problem. */
  readonly code: PolicyIssueCode
  /** Where the problem sits in the config, such as `embedders[2]`; empty when the config itself is at fault. */
  readonly path: string
  /** The whole sentence a tool prints, which names the path itself. */
  readonly message: string
}

/**
 * Narrows an unknown value to a plain record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 *
 * @example Telling a record from an array
 * ```typescript
 * isRecord({ camera: [] }) // => true
 * isRecord([]) // => false
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Builds an issue whose message opens with the place it was found.
 *
 * @param code - The kind of problem.
 * @param path - Where the problem sits in the config.
 * @param text - What is wrong there, as the rest of the sentence.
 * @returns The issue, its message reading `<path> <text>`.
 *
 * @example Reporting an empty source
 * ```typescript
 * policyIssue('embedder-empty', 'embedders[0]', 'must not be empty.')
 * // => { code: 'embedder-empty', path: 'embedders[0]', message: 'embedders[0] must not be empty.' }
 * ```
 */
export function policyIssue(code: PolicyIssueCode, path: string, text: string): PolicyIssue {
  return { code, path, message: `${path} ${text}` }
}

/**
 * Throws when there is anything to report, so a caller that builds a header never builds one from refused input.
 *
 * @param problems - The sentences to report, in the order they were found.
 * @throws {Error} One error whose message holds every sentence on a line of its own.
 *
 * @example Refusing a preset's input
 * ```typescript
 * refuse(['scope.prefix must be a string.']) // throws
 * refuse([]) // returns
 * ```
 */
export function refuse(problems: readonly string[]): void {
  if (problems.length > 0) {
    throw createError(problems.join('\n'))
  }
}
