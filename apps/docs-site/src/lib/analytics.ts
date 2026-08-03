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

/**
 * Send a GA4 event. No-op outside the browser or when analytics is not
 * configured, so callers never need to gate on environment.
 *
 * @param name - GA4 event name (e.g., 'page_view', 'select_content')
 * @param params - Event parameters forwarded to gtag
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return
  callGtag('event', name, params ?? {})
}

/**
 * Report a Google Ads conversion. No-op outside the browser or when either
 * the GA4 or Google Ads ID is not configured.
 *
 * @param conversionLabel - Conversion label from the Google Ads tag setup
 * @param params - Extra conversion parameters (value, currency, transaction_id, …)
 */
export function trackConversion(conversionLabel: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || !GOOGLE_ADS_ID || typeof window === 'undefined') return
  callGtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`, ...(params ?? {}) })
}
