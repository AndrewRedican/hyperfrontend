import type { PolicyIssue, PolicyIssueCode } from './issues'
import type { ServeConfig, ServeHeaderRule } from './serve-types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { checkHeaderPolicy } from './interplay'
import { isRecord } from './issues'

/** The COEP values that, paired with COOP same-origin, make a document cross-origin isolated. */
export const ISOLATION_VALUES: readonly string[] = ['require-corp', 'credentialless']

// note: RFC 7230 token characters: the only bytes legal in a header field name.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

// note: The three characters a header value has always been refused for; they are reported where they always were, ahead of what the later checks find.
const HEADER_VALUE_FORBIDDEN = /[\r\n\0]/

// note: Every character Node's setHeader rejects at request time: a control character other than a tab, and anything above U+00FF. Catching them here turns a config typo into a load error instead of a per-request crash.
const HEADER_VALUE_UNSENDABLE = /[^\t\x20-\x7e\x80-\xff]/

// note: Everything above the one byte a header character is sent as; what else Node rejects is a control character and is reported in the words the three above always were.
const HEADER_VALUE_WIDE = /[\u0100-\uffff]/g

// note: Every field a serve config takes; "$schema" is the editor hint a JSON config may carry.
const CONFIG_FIELDS: readonly string[] = [
  '$schema',
  'root',
  'port',
  'host',
  'log',
  'isolation',
  'embedders',
  'permissionsPolicy',
  'headers',
]

const RULE_FIELDS: readonly string[] = ['prefix', 'suffix', 'headers']

/** A fully-resolved `hf-serve.config.*`: concrete root, listen address, and header rules. */
export interface ResolvedServeConfig {
  /** Absolute directory served as the site root. */
  readonly root: string
  /** Port the server listens on; 0 lets the operating system choose one, which the server's handle reports. */
  readonly port: number
  /** Interface the server binds; every interface when `undefined`. */
  readonly host?: string
  /** Ordered header rules, later rules overriding earlier ones per header. */
  readonly headers: readonly ServeHeaderRule[]
  /** Whether each request is access-logged. A line is written only when the server was also given a log sink. */
  readonly log: boolean
  /** Absolute path of the config file that was loaded, absent when serving with pure defaults. */
  readonly sourcePath?: string
}

/** How one scalar field of a serve config is checked. */
interface FieldCheck {
  /** The field's name. */
  readonly field: string
  /** The kind of problem a refused value reports. */
  readonly code: PolicyIssueCode
  /** The whole sentence a refused value reports. */
  readonly message: string
  /** Tells whether a value that is present is one the field takes. */
  readonly accepts: (value: unknown) => boolean
}

/**
 * Narrows an unknown value to a string that names something.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a string of at least one character.
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

/**
 * Narrows an unknown value to a valid TCP port number (an integer from 1 to 65535).
 *
 * @param value - The value to test.
 * @returns `true` when the value is a usable port.
 */
function isPort(value: unknown): value is number {
  return typeof value === 'number' && isInteger(value) && value >= 1 && value <= 65535
}

// note: Listed in the order the fields have always been checked, which is the order their problems are reported in.
const FIELD_CHECKS: readonly FieldCheck[] = [
  { field: 'root', code: 'root-invalid', message: '"root" must be a non-empty string.', accepts: isNonEmptyString },
  { field: 'port', code: 'port-invalid', message: '"port" must be an integer between 1 and 65535.', accepts: isPort },
  { field: 'host', code: 'host-invalid', message: '"host" must be a non-empty string.', accepts: isNonEmptyString },
  { field: 'log', code: 'log-invalid', message: '"log" must be a boolean.', accepts: (value) => typeof value === 'boolean' },
  {
    field: 'isolation',
    code: 'isolation-invalid',
    message: `"isolation" must be one of ${ISOLATION_VALUES.join(', ')}.`,
    accepts: (value) => (ISOLATION_VALUES as readonly unknown[]).includes(value),
  },
]

/**
 * Finds what is wrong with one header of a rule.
 *
 * @param name - The header name as authored.
 * @param value - The value authored for the header.
 * @param path - Where the header sits, used to open the message.
 * @returns The first problem the header has, or none.
 */
function checkHeader(name: string, value: unknown, path: string): readonly PolicyIssue[] {
  if (!HEADER_NAME_PATTERN.test(name)) {
    return [{ code: 'header-name-invalid', path, message: `${path} is not a valid header name.` }]
  }
  if (typeof value !== 'string') {
    return [{ code: 'header-value-not-string', path, message: `${path} must be a string.` }]
  }
  return HEADER_VALUE_FORBIDDEN.test(value)
    ? [{ code: 'header-value-control-character', path, message: `${path} must not contain control characters.` }]
    : []
}

/**
 * Finds what is wrong with the fields a header rule takes: its optional
 * `prefix` and `suffix` strings and its string-valued `headers` record.
 *
 * @param value - The candidate header rule.
 * @param index - The rule's index, used to locate problems in the messages.
 * @returns Every problem found, the bounds first and then each header in authored order.
 */
function checkRule(value: unknown, index: number): readonly PolicyIssue[] {
  const path = `headers[${index}]`
  if (!isRecord(value)) {
    return [{ code: 'rule-not-object', path, message: `${path} must be an object.` }]
  }
  const bounds = (['prefix', 'suffix'] as const)
    .filter((bound) => value[bound] !== undefined && typeof value[bound] !== 'string')
    .map(
      (bound): PolicyIssue => ({ code: `rule-${bound}-invalid`, path: `${path}.${bound}`, message: `${path}.${bound} must be a string.` })
    )
  const headers = value['headers']
  if (!isRecord(headers)) {
    return [...bounds, { code: 'rule-headers-not-object', path: `${path}.headers`, message: `${path}.headers must be an object.` }]
  }
  // why: A name is echoed as a quoted string, so one holding a line break cannot start a line that reads as a second problem.
  return [...bounds, ...keys(headers).flatMap((name) => checkHeader(name, headers[name], `${path}.headers[${stringify(name)}]`))]
}

/**
 * Finds the header values of a rule that Node refuses to send, beyond the
 * three characters {@link checkRule} has always refused: any other control
 * character but a tab, and any character above U+00FF.
 *
 * @param value - The candidate header rule.
 * @param index - The rule's index, used to locate problems in the messages.
 * @returns One problem per such value; none for a header the earlier check already reported, or a value that is no rule.
 */
function checkHeaderValues(value: unknown, index: number): readonly PolicyIssue[] {
  const headers = isRecord(value) ? value['headers'] : undefined
  if (!isRecord(headers)) {
    return []
  }
  return keys(headers)
    .filter((name) => {
      const authored = headers[name]
      return (
        HEADER_NAME_PATTERN.test(name) &&
        typeof authored === 'string' &&
        !HEADER_VALUE_FORBIDDEN.test(authored) &&
        HEADER_VALUE_UNSENDABLE.test(authored)
      )
    })
    .map((name): PolicyIssue => {
      const path = `headers[${index}].headers[${stringify(name)}]`
      return HEADER_VALUE_UNSENDABLE.test((headers[name] as string).replace(HEADER_VALUE_WIDE, ''))
        ? { code: 'header-value-control-character', path, message: `${path} must not contain control characters.` }
        : {
            code: 'header-value-not-latin1',
            path,
            message: `${path} must not contain a character above U+00FF: a header value is sent one byte per character.`,
          }
    })
}

/**
 * Finds what the checks a rule list has always had let through although no
 * server can use it: a hole where a rule belongs, and a header value Node
 * refuses to send. They are reported after the older problems, so a config
 * that was always refused still opens with the sentence it always did.
 *
 * @param rules - The candidate rule list; empty when `headers` is absent or no array.
 * @returns The problems, in list order.
 */
function checkRulesFurther(rules: readonly unknown[]): readonly PolicyIssue[] {
  // why: A hole is skipped by the walk the older checks make, so it is found by index here and reported as the rule it is not.
  return from(rules, (rule, index): readonly PolicyIssue[] =>
    index in rules
      ? checkHeaderValues(rule, index)
      : [{ code: 'rule-not-object', path: `headers[${index}]`, message: `headers[${index}] must be an object.` }]
  ).flat()
}

/**
 * Finds the fields of a header rule that a rule does not take. A mistyped
 * bound would otherwise be dropped in silence and leave the rule matching
 * every path.
 *
 * @param value - The candidate header rule.
 * @param index - The rule's index, used to locate problems in the messages.
 * @returns One problem per unknown field; none for a value that is no record.
 */
function checkRuleFields(value: unknown, index: number): readonly PolicyIssue[] {
  return keys(isRecord(value) ? value : {})
    .filter((key) => !RULE_FIELDS.includes(key))
    .map(
      (key): PolicyIssue => ({
        code: 'rule-unknown-field',
        path: `headers[${index}]`,
        message: `headers[${index}] has an unknown field ${stringify(key)}: a rule takes prefix, suffix and headers.`,
      })
    )
}

/**
 * Throws when a config or a rule has problems, naming the file on every line.
 *
 * @param issues - The problems found.
 * @param sourcePath - The file the value came from.
 * @throws {Error} One error whose message holds each problem on a line of its own.
 */
function refuseIssues(issues: readonly PolicyIssue[], sourcePath: string): void {
  if (issues.length > 0) {
    throw createError(issues.map((issue) => `${sourcePath}: ${issue.message}`).join('\n'))
  }
}

/**
 * Validates one header rule, asserting optional `prefix`/`suffix` strings, a
 * `headers` record of values Node can send, and no other field.
 *
 * @param value - The candidate header rule.
 * @param index - The rule's index, used to locate problems in the error message.
 * @param sourcePath - The file the rule came from, used in the error message.
 * @returns The validated header rule.
 * @throws {Error} When a field is mistyped or unknown, with one line per problem.
 *
 * @example Validating a single header rule
 * ```typescript
 * const rule = validateHeaderRule({ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }, 0, '/p/hf-serve.config.json')
 * ```
 */
export function validateHeaderRule(value: unknown, index: number, sourcePath: string): ServeHeaderRule {
  refuseIssues([...checkRule(value, index), ...checkHeaderValues(value, index), ...checkRuleFields(value, index)], sourcePath)
  return value as ServeHeaderRule
}

/**
 * Collects every problem of an unknown value as a {@link ServeConfig}, where
 * {@link validateServeConfig} throws them.
 *
 * Problems come in a fixed order: `root`, `port`, `host`, `log`, `isolation`,
 * `headers` and each rule; then any hole in the rule list and any header value
 * Node would refuse to send; then `embedders`; then `permissionsPolicy`; then
 * any rule that undoes the declared embedders, judged only when the rules and
 * the embedders are themselves sound; then unknown fields, of the config and
 * of each rule. `$schema` is the one extra field a config may carry. A value
 * that is no object reports that alone.
 *
 * @param value - The loaded config value.
 * @returns The problems, each with a stable code, a path and a full sentence; empty when the config is sound.
 *
 * @example Listing what a tool should report about a config
 * ```typescript
 * checkServeConfig({ port: 0, embedders: ['host.example'] }).map((issue) => issue.message)
 * // => ['"port" must be an integer between 1 and 65535.', 'embedders[0] must start with a scheme and "://", as in https://host.example.']
 * ```
 */
export function checkServeConfig(value: unknown): readonly PolicyIssue[] {
  if (!isRecord(value)) {
    return [{ code: 'config-not-object', path: '', message: 'serve config must be an object.' }]
  }
  const fields = FIELD_CHECKS.filter((check) => value[check.field] !== undefined && !check.accepts(value[check.field])).map(
    (check): PolicyIssue => ({ code: check.code, path: check.field, message: check.message })
  )
  const headers = value['headers']
  const rules: readonly unknown[] = isArray(headers) ? headers : []
  const ruleIssues: readonly PolicyIssue[] =
    headers === undefined || isArray(headers)
      ? rules.flatMap((rule, index) => checkRule(rule, index))
      : [{ code: 'headers-not-array', path: 'headers', message: '"headers" must be an array.' }]
  const furtherRuleIssues = checkRulesFurther(rules)
  return [
    ...fields,
    ...ruleIssues,
    ...furtherRuleIssues,
    ...checkHeaderPolicy(value, ruleIssues.length === 0 && furtherRuleIssues.length === 0),
    ...keys(value)
      .filter((key) => !CONFIG_FIELDS.includes(key))
      .map((key): PolicyIssue => ({ code: 'unknown-field', path: key, message: `${stringify(key)} is not a serve config field.` })),
    ...rules.flatMap((rule, index) => checkRuleFields(rule, index)),
  ]
}

/**
 * Validates an unknown value as a {@link ServeConfig}.
 *
 * @param value - The loaded config value.
 * @param sourcePath - The config path, used in error messages.
 * @returns The validated config.
 * @throws {Error} When the config is malformed, with one line per problem, each opening with the config path.
 *
 * @example Validating a loaded serve config
 * ```typescript
 * const config = validateServeConfig({ root: 'dist/site' }, '/p/hf-serve.config.json')
 * ```
 */
export function validateServeConfig(value: unknown, sourcePath: string): ServeConfig {
  refuseIssues(checkServeConfig(value), sourcePath)
  return value as ServeConfig
}

/**
 * Writes the three headers that make a document cross-origin isolated.
 *
 * @param isolation - The declared COEP value.
 * @returns The opener, embedder and resource policies, in that order.
 *
 * @example Reading the headers an isolation stands for
 * ```typescript
 * isolationHeaders('credentialless')['Cross-Origin-Embedder-Policy'] // => 'credentialless'
 * ```
 */
export function isolationHeaders(isolation: NonNullable<ServeConfig['isolation']>): Record<string, string> {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': isolation,
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }
}

/**
 * Expands a declared isolation into the header rule that produces it.
 *
 * `Cross-Origin-Opener-Policy: same-origin` and the chosen
 * `Cross-Origin-Embedder-Policy` are what make the document cross-origin
 * isolated; `Cross-Origin-Resource-Policy: cross-origin` keeps the origin
 * embeddable by hosts elsewhere.
 *
 * @param isolation - The declared COEP value, or `undefined` when none was declared.
 * @returns A single-element rule list applied to every path, or an empty list.
 *
 * @example Expanding a declared isolation
 * ```typescript
 * isolationRules('require-corp')
 * ```
 */
export function isolationRules(isolation: ServeConfig['isolation']): readonly ServeHeaderRule[] {
  return isolation === undefined ? [] : [{ headers: isolationHeaders(isolation) }]
}
