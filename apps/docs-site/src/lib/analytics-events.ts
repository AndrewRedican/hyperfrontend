/**
 * The site's campaign-measurement taxonomy — every product event that may
 * ever reach Google Analytics is defined here, and only here. The set is
 * deliberately small and limited to interactions that exist today and could
 * meaningfully measure paid-acquisition effectiveness: opening a live demo,
 * following the primary docs call to action, visiting the repository or an
 * npm package, and opening site search. Parameters carry only fixed public identifiers (slugs,
 * package names, link locations) — never user-entered content or personal
 * data. Delivery rides {@link trackEvent}, so nothing leaves the page without
 * a configured measurement ID and granted analytics consent, and the hostee
 * demo apps ship no analytics at all — the host is the single reporter, so
 * embedded, dialog, and popup sessions cannot double-count.
 */
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { trackEvent } from './analytics'

/** How a demo session was presented when it opened. */
export type DemoOpenMode = 'embedded' | 'dialog' | 'popup'

/** Where an outbound repository link was activated. */
export type RepoLinkLocation = 'header' | 'hero' | 'value-proposition' | 'footer'

/** The primary documentation calls to action the site currently renders. */
export type DocsCta = 'hero-get-started' | 'value-prop-get-started'

/** One demo-open report per (slug, mode) per page life — carousel remounts and reconnects stay one open. */
const reportedDemoOpens = createSet<string>()

/**
 * Reports a live demo becoming active in a presentation mode.
 *
 * @param slug - The demo's manifest slug.
 * @param mode - How the session is presented.
 */
export function trackDemoOpen(slug: string, mode: DemoOpenMode): void {
  const key = `${slug}:${mode}`
  if (reportedDemoOpens.has(key)) {
    return
  }
  reportedDemoOpens.add(key)
  trackEvent('demo_open', { demo_slug: slug, demo_mode: mode })
}

/**
 * Reports the primary documentation call to action being followed.
 *
 * @param cta - Which call to action was activated.
 */
export function trackDocsCta(cta: DocsCta): void {
  trackEvent('docs_cta', { cta })
}

/**
 * Reports an outbound visit to the GitHub repository.
 *
 * @param location - Where on the page the link was activated.
 */
export function trackRepoVisit(location: RepoLinkLocation): void {
  trackEvent('repo_visit', { link_location: location })
}

/**
 * Reports an outbound visit to a package on npm.
 *
 * @param packageName - The public npm package name the link targets.
 */
export function trackNpmVisit(packageName: string): void {
  trackEvent('npm_visit', { package_name: packageName })
}

/**
 * Reports the site search dialog being opened.
 */
export function trackSearchOpen(): void {
  trackEvent('search_open')
}

/**
 * Clears the per-page dedupe state. Test seam only.
 */
export function resetCampaignDedupe(): void {
  reportedDemoOpens.clear()
}
