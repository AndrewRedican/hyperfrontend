/**
 * Canonical absolute origin the docs site is served from, without a trailing
 * slash. Overridable at build time via `NEXT_PUBLIC_SITE_URL` so preview
 * deployments can emit self-referential canonical URLs.
 *
 * The default names the host production actually serves: the apex redirects to
 * `www`, so canonical URLs, share links, and feed ids must not point at it.
 *
 * The env var must be read with dot access: Next only inlines `NEXT_PUBLIC_*`
 * values into client bundles for the `process.env.X` spelling — bracket access
 * compiles to `undefined` in the browser.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.hyperfrontend.dev'

/**
 * Origin of the statistics service that collects npm's download counts,
 * without a trailing slash. The downloads page asks it in the browser and the
 * refresh script asks it at build time, so both read this one constant.
 * Overridable via `NEXT_PUBLIC_STATISTICS_ORIGIN`, which points a local site at
 * a local service; an empty value counts as unset, hence `||`.
 *
 * Read with dot access for the same reason as {@link SITE_URL}.
 */
export const STATISTICS_ORIGIN = process.env.NEXT_PUBLIC_STATISTICS_ORIGIN || 'https://hyperfrontend-statistics-production.up.railway.app'

/**
 * Canonical GitHub repository URL, without a trailing slash. Issue, discussion,
 * and source links compose onto it so the coordinates live in one place.
 */
export const REPO_URL = 'https://github.com/AndrewRedican/hyperfrontend'

/**
 * The address the support page invites readers to write to.
 *
 */
export const SUPPORT_EMAIL = 'support@hyperfrontend.dev'

/** Subject a support mail opens with, so a message arrives already identifiable. */
export const SUPPORT_MAIL_SUBJECT = 'HyperFrontend question'
