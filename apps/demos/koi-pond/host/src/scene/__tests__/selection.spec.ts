import type { KoiCardPanel } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it, vi } from 'vitest'
import { describePond } from '@hyperfrontend/demo-koi-lib'
import { createSelectionChrome } from '../selection'

/** The pond every fixture here swims in. */
const POND = describePond(1200, 800, 1200, 800, false)

/** A card panel as a fish would report it. */
const PANEL: KoiCardPanel = {
  frame: { x: 300, y: 180, width: 220, height: 96 },
  app: { x: 312, y: 220, width: 180, height: 14 },
  site: { x: 312, y: 250, width: 120, height: 13 },
  source: { x: 312, y: 266, width: 96, height: 13 },
}

/** Builds a root and the chrome under test. */
function harness() {
  const root = document.createElement('div')
  const chrome = createSelectionChrome(root)
  return { root, chrome }
}

describe('the card chrome', () => {
  it('raises a shield and three anchors for a held koi, hidden until the card reports', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    expect(root.querySelector('.koi-card-shield')?.hasAttribute('hidden')).toBe(true)
    expect(root.querySelectorAll('.koi-card-link')).toHaveLength(3)
  })

  it('never doubles up however many times the same koi is held', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    expect(root.querySelectorAll('.koi-card-shield')).toHaveLength(1)
  })

  it('links the app URL, the framework site, and the app source as ordinary new-tab anchors', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    const [app, site, source] = [...root.querySelectorAll<HTMLAnchorElement>('.koi-card-link')]
    expect(app?.href).toBe('https://pond.test/fish-lit/')
    expect(site?.href).toBe('https://lit.dev/')
    expect(source?.href).toContain('github.com/AndrewRedican/hyperfrontend')
    expect(source?.href).toContain('fish-lit')
    expect(app?.target).toBe('_blank')
    expect(app?.rel).toBe('noopener noreferrer')
    expect(site?.rel).toBe('noopener noreferrer')
    expect(source?.rel).toBe('noopener noreferrer')
  })

  it('floats every piece over the reported card, in view coordinates', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.trackCard('lit', PANEL, POND)
    const shield = root.querySelector<HTMLElement>('.koi-card-shield')
    const [app, site] = [...root.querySelectorAll<HTMLAnchorElement>('.koi-card-link')]
    expect(shield?.hidden).toBe(false)
    expect(shield?.style.width).toBe('220px')
    expect(shield?.style.transform).toContain(`${(300 - POND.view.x).toFixed(1)}px`)
    expect(app?.style.width).toBe('180px')
    expect(site?.style.transform).toContain(`${(312 - POND.view.x).toFixed(1)}px`)
  })

  it('hides only the source anchor when an older shell reports a card without one', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    const bare = <KoiCardPanel>(<unknown>{ frame: PANEL.frame, app: PANEL.app, site: PANEL.site })
    chrome.trackCard('lit', bare, POND)
    const [app, site, source] = [...root.querySelectorAll<HTMLAnchorElement>('.koi-card-link')]
    expect(app?.hidden).toBe(false)
    expect(site?.hidden).toBe(false)
    expect(source?.hidden).toBe(true)
  })

  it('hides while the card has no geometry to sit on', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.trackCard('lit', PANEL, POND)
    chrome.trackCard('lit', null, POND)
    expect(root.querySelector<HTMLElement>('.koi-card-shield')?.hidden).toBe(true)
    expect([...root.querySelectorAll<HTMLAnchorElement>('.koi-card-link')].every((link) => link.hidden)).toBe(true)
  })

  it('contains presses so a card click never strikes the water behind it', () => {
    const { root, chrome } = harness()
    const reached = vi.fn<() => void>()
    root.addEventListener('pointerdown', reached)
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.trackCard('lit', PANEL, POND)
    const shield = root.querySelector<HTMLElement>('.koi-card-shield')
    shield?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    root.querySelector<HTMLAnchorElement>('.koi-card-link')?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(reached).not.toHaveBeenCalled()
  })

  it('leaves with the release', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.release('lit')
    expect(root.querySelector('.koi-card-shield')).toBeNull()
    expect(root.querySelectorAll('.koi-card-link')).toHaveLength(0)
  })

  it('takes everything down on dispose', () => {
    const { root, chrome } = harness()
    chrome.hold('lit', 'https://pond.test/fish-lit/')
    chrome.hold('vue', 'https://pond.test/fish-vue/')
    chrome.dispose()
    expect(root.querySelectorAll('.koi-card-shield, .koi-card-link')).toHaveLength(0)
  })
})
