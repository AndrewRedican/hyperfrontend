import { describe, expect, it } from 'vitest'
import { GOOGLE_CONSENT_DEFAULTS, googleConsentSignals } from './google-consent'

describe('googleConsentSignals', () => {
  it('defaults every signal to denied', () => {
    expect(GOOGLE_CONSENT_DEFAULTS).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
  })

  it('denies everything when both categories are refused', () => {
    expect(googleConsentSignals({ analytics: false, advertising: false })).toEqual(GOOGLE_CONSENT_DEFAULTS)
  })

  it('analytics consent grants only analytics storage', () => {
    expect(googleConsentSignals({ analytics: true, advertising: false })).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
  })

  it('advertising consent grants all three advertising fields together', () => {
    expect(googleConsentSignals({ analytics: false, advertising: true })).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    })
  })

  it('granting both categories grants every field', () => {
    expect(googleConsentSignals({ analytics: true, advertising: true })).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    })
  })
})
