/**
 * Google tag plumbing, gated end to end by the consent store.
 *
 * The site runs Consent Mode v2 in **basic** form: until the visitor grants
 * an optional category, no Google library loads and no analytics or
 * advertising request leaves the page — not even cookieless pings. Granting
 * analytics configures GA4; granting advertising configures the Ads tag
 * (when an Ads ID exists); withdrawing pushes a denied consent update and
 * stops future collection. Everything is a no-op while the measurement ID is
 * unset, which is the permanent state of development, preview, and test
 * builds.
 */
import type { StoredConsent } from './consent/consent'
import { consentStore } from './consent/consent'
import { googleConsentSignals } from './consent/google-consent'

/**
 * GA4 measurement ID (`G-…`) the site reports to. Only configured in the
 * production environment — when unset, no analytics scripts render and every
 * helper in this module is a no-op.
 *
 * The env var must be read with dot access: Next only inlines `NEXT_PUBLIC_*`
 * values into client bundles for the `process.env.X` spelling — bracket access
 * compiles to `undefined` in the browser.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

/**
 * Google Ads account ID (`AW-…`) used for conversion tracking. Optional —
 * conversion reporting is disabled when unset.
 *
 * Read with dot access for the same client-bundle inlining reason as
 * {@link GA_MEASUREMENT_ID}.
 */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

declare global {
  /** Browser window augmented with the Google tag globals gtag.js relies on. */
  interface Window {
    /** Google tag command queue; created by the analytics bootstrap script or the first queued command. */
    dataLayer?: unknown[]
    /** Google tag command function; forwards its arguments onto the data layer. */
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Queue a Google tag command, installing the standard `gtag` stub first when
 * the bootstrap script has not run yet so early commands are still delivered
 * once gtag.js loads.
 *
 * @param args - Positional gtag command arguments (command, target, params)
 */
function callGtag(...args: unknown[]): void {
  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    window.gtag = function gtag(): void {
      // why: gtag.js only replays queue entries shaped like an arguments object, so the raw arguments object is pushed instead of an array
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
  }
  window.gtag(...args)
}

/** Tags configured this page life — each Google tag gets exactly one `config` no matter how often consent changes. */
const configured = { ga: false, ads: false }

/**
 * Applies a consent decision to the Google layer: pushes the Consent Mode v2
 * update and configures whichever granted tags are not configured yet. Safe
 * to call repeatedly; a no-op without a measurement ID, outside the browser,
 * or before any decision exists.
 *
 * @param decision - The stored decision to apply, usually `consentStore.getDecision()`.
 */
export function applyConsentToGoogleTags(decision: StoredConsent | null): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || decision === null) {
    return
  }
  callGtag('consent', 'update', googleConsentSignals(decision))
  if (decision.analytics && !configured.ga) {
    configured.ga = true
    // why: page views ride the route tracker, not gtag's own history hooks — send_page_view stays off so App Router navigations count exactly once.
    callGtag('config', GA_MEASUREMENT_ID, { send_page_view: false })
  }
  if (decision.advertising && GOOGLE_ADS_ID !== undefined && GOOGLE_ADS_ID !== '' && !configured.ads) {
    configured.ads = true
    callGtag('config', GOOGLE_ADS_ID)
  }
}

/**
 * Judges whether the Google tag library should be on the page at all — basic
 * consent mode loads it only after some optional category is granted.
 *
 * @param decision - The stored decision, or `null` before any choice.
 * @returns `true` once an optional grant justifies loading gtag.js.
 */
export function shouldLoadGoogleTag(decision: StoredConsent | null): boolean {
  if (!GA_MEASUREMENT_ID || decision === null) {
    return false
  }
  return decision.analytics || decision.advertising
}

/**
 * Send a GA4 event. A no-op outside the browser, when analytics is not
 * configured, or until the visitor grants the analytics category — callers
 * never need to gate on environment or consent themselves.
 *
 * @param name - GA4 event name (e.g., 'page_view', 'select_content')
 * @param params - Event parameters forwarded to gtag
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !consentStore.isGranted('analytics')) {
    return
  }
  callGtag('event', name, params ?? {})
}

/**
 * Report a Google Ads conversion. A no-op outside the browser, when either
 * the GA4 or Google Ads ID is not configured, or until the visitor grants the
 * advertising category.
 *
 * @param conversionLabel - Conversion label from the Google Ads tag setup
 * @param params - Extra conversion parameters (value, currency, transaction_id, …)
 */
export function trackConversion(conversionLabel: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || !GOOGLE_ADS_ID || typeof window === 'undefined' || !consentStore.isGranted('advertising')) {
    return
  }
  callGtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`, ...(params ?? {}) })
}
