import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Loads the analytics module (and its consent store) fresh, optionally with
 * measurement IDs stubbed into the environment first. The IDs are obvious
 * fakes: nothing here ever loads gtag.js or leaves the process — the tests
 * only inspect the local command queue.
 *
 * @param ga - Optional GA4 measurement ID to stub.
 * @param ads - Optional Google Ads ID to stub.
 * @returns The fresh analytics module plus its consent store.
 */
async function loadAnalytics(ga?: string, ads?: string) {
  if (ga !== undefined) {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', ga)
  }
  if (ads !== undefined) {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', ads)
  }
  const analytics = await import('@/lib/analytics')
  const { consentStore } = await import('@/lib/consent/consent')
  return { ...analytics, consentStore }
}

/**
 * The gtag command queue as plain arrays.
 *
 * @returns Every queued command, argument lists included.
 */
function layerCalls(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(<ArrayLike<unknown>>entry))
}

/**
 * The queued `config` targets, in order.
 *
 * @returns The tag IDs that received a config command.
 */
function configuredTargets(): unknown[] {
  return layerCalls()
    .filter((call) => call[0] === 'config')
    .map((call) => call[1])
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  window.localStorage.clear()
  delete window.dataLayer
  delete window.gtag
})

describe('without a measurement id', () => {
  it('trackEvent sends nothing', async () => {
    const { trackEvent } = await loadAnalytics()
    trackEvent('page_view', { page_path: '/' })
    expect(window.dataLayer).toBeUndefined()
  })

  it('the google tag never loads', async () => {
    const { shouldLoadGoogleTag, consentStore } = await loadAnalytics()
    expect(shouldLoadGoogleTag(consentStore.decide({ analytics: true, advertising: true }))).toBe(false)
  })

  it('consent application is inert', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics()
    applyConsentToGoogleTags(consentStore.decide({ analytics: true, advertising: true }))
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('with a measurement id', () => {
  it('trackEvent stays silent before any consent', async () => {
    const { trackEvent } = await loadAnalytics('G-TEST')
    trackEvent('page_view', { page_path: '/' })
    expect(window.dataLayer).toBeUndefined()
  })

  it('rejecting optional keeps events silent', async () => {
    const { trackEvent, consentStore } = await loadAnalytics('G-TEST')
    consentStore.decide({ analytics: false, advertising: false })
    trackEvent('page_view', { page_path: '/' })
    expect(layerCalls().filter((call) => call[0] === 'event')).toHaveLength(0)
  })

  it('the analytics grant lets events flow', async () => {
    const { trackEvent, consentStore } = await loadAnalytics('G-TEST')
    consentStore.decide({ analytics: true, advertising: false })
    trackEvent('demo_open', { demo_slug: 'heartbeat' })
    expect(layerCalls()).toEqual(expect.arrayContaining([['event', 'demo_open', { demo_slug: 'heartbeat' }]]))
  })

  it('the tag loads only once an optional category is granted', async () => {
    const { shouldLoadGoogleTag, consentStore } = await loadAnalytics('G-TEST')
    const denied = consentStore.decide({ analytics: false, advertising: false })
    const granted = consentStore.decide({ analytics: true, advertising: false })
    expect([shouldLoadGoogleTag(null), shouldLoadGoogleTag(denied), shouldLoadGoogleTag(granted)]).toEqual([false, false, true])
  })

  it('the analytics grant configures ga exactly once across repeated applications', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics('G-TEST')
    const decision = consentStore.decide({ analytics: true, advertising: false })
    applyConsentToGoogleTags(decision)
    applyConsentToGoogleTags(decision)
    expect(configuredTargets()).toEqual(['G-TEST'])
  })

  it('analytics-only consent never configures the ads tag', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics('G-TEST', 'AW-TEST')
    applyConsentToGoogleTags(consentStore.decide({ analytics: true, advertising: false }))
    expect(configuredTargets()).toEqual(['G-TEST'])
  })

  it('the advertising grant updates every consent-mode ad field', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics('G-TEST', 'AW-TEST')
    applyConsentToGoogleTags(consentStore.decide({ analytics: false, advertising: true }))
    expect(layerCalls()).toEqual(
      expect.arrayContaining([
        [
          'consent',
          'update',
          { analytics_storage: 'denied', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' },
        ],
      ])
    )
  })

  it('the advertising grant configures the ads tag without configuring ga', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics('G-TEST', 'AW-TEST')
    applyConsentToGoogleTags(consentStore.decide({ analytics: false, advertising: true }))
    expect(configuredTargets()).toEqual(['AW-TEST'])
  })

  it('withdrawal pushes a fully denied consent update', async () => {
    const { applyConsentToGoogleTags, consentStore } = await loadAnalytics('G-TEST')
    applyConsentToGoogleTags(consentStore.decide({ analytics: true, advertising: true }))
    applyConsentToGoogleTags(consentStore.withdrawOptional())
    const updates = layerCalls().filter((call) => call[0] === 'consent')
    expect(updates[updates.length - 1]).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ])
  })

  it('conversions require the advertising grant', async () => {
    const { trackConversion, consentStore } = await loadAnalytics('G-TEST', 'AW-TEST')
    consentStore.decide({ analytics: true, advertising: false })
    trackConversion('label')
    expect(layerCalls().filter((call) => call[0] === 'event')).toHaveLength(0)
  })

  it('conversions flow once advertising is granted', async () => {
    const { trackConversion, consentStore } = await loadAnalytics('G-TEST', 'AW-TEST')
    consentStore.decide({ analytics: false, advertising: true })
    trackConversion('label', { value: 1 })
    expect(layerCalls()).toEqual(expect.arrayContaining([['event', 'conversion', { send_to: 'AW-TEST/label', value: 1 }]]))
  })
})
