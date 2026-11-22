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
 * One origin allowed to frame what a server sends, as a `frame-ancestors`
 * source: `'self'`, `'none'` as the only entry of its list, or
 * `scheme://host` with an optional leading `*.` label and an optional port,
 * in lowercase ASCII with no path.
 */
export type EmbedderSource = string

/**
 * The paths a preset's header rule applies to. A rule matches when the path
 * starts with `prefix` (when given) and ends with `suffix` (when given); a
 * scope with neither, like no scope at all, matches every path.
 */
export interface RuleScope {
  /** Path prefix the rule applies under, e.g. `/app/`. */
  readonly prefix?: string
  /** Path suffix the rule applies to, e.g. `.html`. */
  readonly suffix?: string
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
   * that opener is both same-origin and itself isolated, so a page served
   * this way keeps a working `window.opener` only when a same-origin isolated
   * page opens it.
   */
  isolation?: 'require-corp' | 'credentialless'
  /**
   * The origins allowed to frame every response, expanded into a
   * `Content-Security-Policy` holding one `frame-ancestors` directive. An
   * empty list allows none. `X-Frame-Options` is sent beside it when the list
   * is empty, `'none'` or `'self'` alone.
   *
   * The expansion is placed ahead of every other rule, so a later rule may
   * scope a different list to a prefix or suffix. A rule that sets
   * `Content-Security-Policy` must carry a `frame-ancestors` directive of its
   * own, since the header is replaced whole; a rule that matches every path
   * must list exactly the sources declared here.
   *
   * A source is refused when it would permit every origin (`*`, a scheme on
   * its own, a `*` host), carries a path, lacks a scheme, or is not lowercase
   * ASCII. An IPv4 literal is accepted, though browsers differ on whether it
   * ever matches.
   */
  embedders?: EmbedderSource[]
  /**
   * The browser features the served documents may use, expanded into one
   * `Permissions-Policy` header. Each key is a feature name and each value
   * the origins allowed to use it: `[]` disables the feature, `['self']`
   * keeps it for this origin, `['*']` allows every origin, and
   * `scheme://host` entries name others.
   *
   * This restricts what a document can do whatever its embedder delegates; it
   * is not the list of features a document asks its embedder for. The
   * expansion is placed after the one for `embedders` and ahead of the one
   * for `isolation`.
   */
  permissionsPolicy?: Record<string, string[]>
  /** Ordered header rules, later rules overriding earlier ones per header. */
  headers?: ServeHeaderRule[]
  /** Whether each request is access-logged: one line per request, written to the log sink the server is given and nowhere when it is given none. */
  log?: boolean
}

/**
 * The fields of a serve config that decide response headers: everything a
 * server needs to build its ordered header rules, and nothing about where it
 * listens or what it serves.
 */
export type HeaderPolicy = Pick<ServeConfig, 'embedders' | 'permissionsPolicy' | 'isolation' | 'headers'>

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
