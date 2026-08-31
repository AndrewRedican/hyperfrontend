import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Loads the taxonomy with an analytics grant in place, so events reach the queue.
 *
 * @returns The fresh taxonomy module.
 */
async function loadGrantedTaxonomy() {
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST')
  const { consentStore } = await import('@/lib/consent/consent')
  consentStore.decide({ analytics: true, advertising: false })
  return import('@/lib/analytics-events')
}

/**
 * The queued GA events as [name, params] pairs.
 *
 * @returns Every queued event command without its leading keyword.
 */
function queuedEvents(): unknown[][] {
  return (window.dataLayer ?? [])
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((call) => call[0] === 'event')
    .map((call) => call.slice(1))
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  window.localStorage.clear()
  delete window.dataLayer
  delete window.gtag
})

describe('demo opens', () => {
  it('reports one open per demo and mode per page life', async () => {
    const { trackDemoOpen } = await loadGrantedTaxonomy()
    trackDemoOpen('heartbeat', 'embedded')
    trackDemoOpen('heartbeat', 'embedded')
    expect(queuedEvents()).toEqual([['demo_open', { demo_slug: 'heartbeat', demo_mode: 'embedded' }]])
  })

  it('reports each presentation mode separately', async () => {
    const { trackDemoOpen } = await loadGrantedTaxonomy()
    trackDemoOpen('heartbeat', 'embedded')
    trackDemoOpen('heartbeat', 'dialog')
    expect(queuedEvents()).toHaveLength(2)
  })

  it('the dedupe reset allows a fresh report', async () => {
    const { trackDemoOpen, resetCampaignDedupe } = await loadGrantedTaxonomy()
    trackDemoOpen('clock', 'embedded')
    resetCampaignDedupe()
    trackDemoOpen('clock', 'embedded')
    expect(queuedEvents()).toHaveLength(2)
  })
})

describe('outbound and cta events', () => {
  it('maps each helper to its centrally defined event', async () => {
    const { trackDocsCta, trackNpmVisit, trackRepoVisit } = await loadGrantedTaxonomy()
    trackDocsCta('hero-get-started')
    trackRepoVisit('footer')
    trackNpmVisit('@hyperfrontend/features')
    expect(queuedEvents()).toEqual([
      ['docs_cta', { cta: 'hero-get-started' }],
      ['repo_visit', { link_location: 'footer' }],
      ['npm_visit', { package_name: '@hyperfrontend/features' }],
    ])
  })

  it('sends nothing without the analytics grant', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST')
    const { trackRepoVisit } = await import('@/lib/analytics-events')
    trackRepoVisit('header')
    expect(window.dataLayer).toBeUndefined()
  })
})
