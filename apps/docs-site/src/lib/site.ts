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
