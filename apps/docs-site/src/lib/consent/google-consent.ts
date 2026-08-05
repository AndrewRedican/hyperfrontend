/**
 * Google Consent Mode v2 adapter: maps the site's provider-agnostic consent
 * model onto the Google signal fields. The site runs consent mode in *basic*
 * form — no Google tag loads at all before the relevant grant, so there are
 * no cookieless pings before consent — which makes this mapping the single
 * place Google's vocabulary appears in the consent layer.
 */
import type { ConsentChoices } from './consent'

/** The Consent Mode v2 signal states. */
export type GoogleConsentState = 'granted' | 'denied'

/** The Consent Mode v2 fields the site manages. */
export interface GoogleConsentSignals {
  /** Storage for analytics measurement (GA4). */
  analytics_storage: GoogleConsentState
  /** Storage for advertising (conversion cookies). */
  ad_storage: GoogleConsentState
  /** Sending user data to Google for advertising purposes. */
  ad_user_data: GoogleConsentState
  /** Personalized advertising (remarketing). */
  ad_personalization: GoogleConsentState
}

/** The default signal set: everything denied until the visitor grants a category. */
export const GOOGLE_CONSENT_DEFAULTS: GoogleConsentSignals = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
}

/**
 * Maps a consent decision onto Consent Mode v2 signals: the analytics
 * category controls `analytics_storage`; the advertising category controls
 * all three advertising fields together.
 *
 * @param choices - The visitor's decision over the optional categories.
 * @returns The signal set for a `gtag('consent', 'update', …)` call.
 */
export function googleConsentSignals(choices: ConsentChoices): GoogleConsentSignals {
  const advertising: GoogleConsentState = choices.advertising ? 'granted' : 'denied'
  return {
    analytics_storage: choices.analytics ? 'granted' : 'denied',
    ad_storage: advertising,
    ad_user_data: advertising,
    ad_personalization: advertising,
  }
}
