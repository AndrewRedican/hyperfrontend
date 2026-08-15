/**
 * One ordered header rule for the static server: response headers applied to
 * every request whose path matches the rule.
 *
 * A rule matches when the path starts with `prefix` (when given) and ends with
 * `suffix` (when given); a rule with neither matches everything. Rules are
 * applied in order and later rules override earlier ones one header at a time.
 */
export interface ServeHeaderRule {
  /** Path prefix the rule applies under, e.g. `/fish-`; matches everything when omitted. */
  prefix?: string
  /** Path suffix the rule applies to, e.g. `.html`; matches everything when omitted. */
  suffix?: string
  /** Header names and values the rule sets. */
  headers: Record<string, string>
}

/**
 * Type-checked authoring shape for an `hf-serve.config.*` file.
 */
export interface ServeConfig {
  /** Directory served as the site root. */
  root?: string
  /** Port the server listens on. */
  port?: number
  /** Interface the server binds; every interface when omitted. */
  host?: string
  /** Ordered header rules, later rules overriding earlier ones per header. */
  headers?: ServeHeaderRule[]
  /** Whether each request is access-logged to stdout. */
  log?: boolean
}

/**
 * Identity helper that gives `hf-serve.config.*` files type-checked authoring.
 *
 * @param config - The static-server configuration object.
 * @returns The same configuration object, narrowed to {@link ServeConfig}.
 *
 * @example Authoring a typed `hf-serve.config.ts`
 * ```typescript
 * export default defineServeConfig({ root: 'dist/site', headers: [{ headers: { 'X-Content-Type-Options': 'nosniff' } }] })
 * ```
 */
export const defineServeConfig = (config: ServeConfig): ServeConfig => config
