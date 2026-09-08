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
  /**
   * Cross-origin isolation applied to every response, expanded into
   * `Cross-Origin-Opener-Policy: same-origin`, the matching
   * `Cross-Origin-Embedder-Policy`, and
   * `Cross-Origin-Resource-Policy: cross-origin`.
   *
   * Declaring it here rather than spelling the headers by hand keeps the intent
   * legible and reviewable. The expansion is placed before the `headers` rules,
   * so an explicit rule still overrides any of the three.
   *
   * An isolated origin severs the opener of any window opened onto it unless
   * that opener is both same-origin and itself isolated, so a feature served
   * this way reaches the `popup` and `standalone` display modes from
   * same-origin isolated hosts only.
   */
  isolation?: 'require-corp' | 'credentialless'
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
