import type { EmbedderSource, RuleScope, ServeHeaderRule } from './serve-types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { checkEmbedders, frameAncestors, frameOptions } from './embedders'
import { refuse } from './issues'
import { scopedRule, scopeProblems } from './scope'

/** What a {@link contentSecurityPolicy} rule is built from. */
export interface ContentSecurityPolicyOptions {
  /** The origins allowed to frame the response, written last as the `frame-ancestors` directive; an empty list allows none. */
  readonly embedders: readonly EmbedderSource[]
  /** Directives to add, or to put in place of a default of the same name; an empty list writes the bare directive name. */
  readonly directives?: Readonly<Record<string, readonly string[]>>
}

// note: A starting policy that loads from the page's own origin only; an authored directive of the same name takes the default's place.
const DEFAULT_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
}

const DIRECTIVE_NAME = /^[a-z0-9-]+$/

// note: Visible ASCII without the semicolon that ends a directive or the comma that starts another policy.
const DIRECTIVE_VALUE = /^[!-+\--:<-~]+$/

// note: The whitespace the policy grammar separates a directive's tokens with.
const TOKEN_SEPARATOR = /[\t\n\f\r ]+/

// note: ASCII whitespace and visible ASCII, the only characters of a directive a browser enforces.
const ENFORCED_DIRECTIVE = /^[\t\n\f\r -~]*$/

/**
 * Finds what is wrong with one authored directive.
 *
 * @param name - The directive name as authored.
 * @param values - The value authored for the directive.
 * @returns One sentence for a refused name or a value that is no array, otherwise one per refused entry.
 */
function directiveProblems(name: string, values: unknown): readonly string[] {
  const path = `directives[${stringify(name)}]`
  if (!DIRECTIVE_NAME.test(name)) {
    return [`${path} is not a directive name: use lowercase letters, digits and hyphens.`]
  }
  if (name === 'frame-ancestors') {
    return [`${path} is set through "embedders", not here.`]
  }
  if (!isArray(values)) {
    return [`${path} must be an array of values.`]
  }
  // why: A hole is walked like any value, so a list a doubled comma left sparse is refused instead of being written with an empty slot.
  return from(values, (value: unknown, index) =>
    typeof value === 'string' && DIRECTIVE_VALUE.test(value)
      ? []
      : [`${path}[${index}] must be one value of visible ASCII with no whitespace, ";" or ",".`]
  ).flat()
}

/**
 * Builds the header rule for a whole `Content-Security-Policy`: four default
 * directives that load from the page's own origin, the authored directives,
 * and `frame-ancestors` from the declared embedders, always last.
 *
 * An authored directive that names a default takes the default's position, and
 * a new one follows the defaults in authored order. `X-Frame-Options` is added
 * when the embedders list is empty, `'none'` or `'self'` alone. The embedders
 * are required: there is no safe guess for who may frame a page.
 *
 * @param options - The embedders and any directives beyond the defaults.
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When an embedder, a directive or the scope is refused, with one line per problem.
 *
 * @example Allowing WebAssembly on the pages one host may frame
 * ```typescript
 * contentSecurityPolicy(
 *   { embedders: ['https://host.example'], directives: { 'script-src': ["'self'", "'wasm-unsafe-eval'"] } },
 *   { suffix: '.html' }
 * )
 * ```
 */
export function contentSecurityPolicy(options: ContentSecurityPolicyOptions, scope?: RuleScope): ServeHeaderRule {
  const authored: Readonly<Record<string, unknown>> = options.directives ?? {}
  refuse([
    ...checkEmbedders(options.embedders).map((issue) => issue.message),
    ...keys(authored).flatMap((name) => directiveProblems(name, authored[name])),
    ...scopeProblems(scope),
  ])
  const directives: Record<string, readonly string[]> = { ...DEFAULT_DIRECTIVES, ...options.directives }
  const policy = [
    ...keys(directives).map((name) => [name, ...(directives[name] as readonly string[])].join(' ')),
    frameAncestors(options.embedders),
  ]
  return scopedRule({ 'Content-Security-Policy': policy.join('; '), ...frameOptions(options.embedders) }, scope)
}

/**
 * Reads the `frame-ancestors` source list of each policy in a
 * `Content-Security-Policy` header value.
 *
 * A comma separates whole policies, and a browser enforces every one of them,
 * so the result holds one list per policy that names the directive. The name
 * is matched without regard to case, and the first occurrence in a policy
 * wins, as it does in a browser. A value in which no policy names the
 * directive restricts no embedder and reads as an empty result.
 *
 * A directive holding any character other than ASCII whitespace and visible
 * ASCII is read as absent, because a browser discards it whole: a no-break
 * space beside the name or a host that is not in its punycode form leaves the
 * response framable by any origin.
 *
 * @param policy - The header value.
 * @returns One source list per comma-separated policy that names the directive.
 *
 * @example Reading who may frame a response
 * ```typescript
 * frameAncestorsOf("default-src 'self'; frame-ancestors 'self' https://host.example") // => [["'self'", 'https://host.example']]
 * frameAncestorsOf("default-src 'self'") // => []
 * frameAncestorsOf("frame-ancestors 'self' https://b\u00fccher.example") // => []
 * ```
 */
export function frameAncestorsOf(policy: string): readonly (readonly string[])[] {
  return policy.split(',').flatMap((serialized) => {
    const directive = serialized
      .split(';')
      // why: Only ASCII whitespace is stripped from a directive, so any other character stays in it and makes a browser drop the directive.
      .filter((text) => ENFORCED_DIRECTIVE.test(text))
      .map((text) => text.split(TOKEN_SEPARATOR).filter((token) => token.length > 0))
      .find((tokens) => tokens[0]?.toLowerCase() === 'frame-ancestors')
    return directive === undefined ? [] : [directive.slice(1)]
  })
}
