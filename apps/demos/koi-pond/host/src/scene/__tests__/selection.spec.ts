import type { KoiFramework, KoiOutline } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { describePond } from '@hyperfrontend/demo-koi-lib'
import { createSelectionChrome } from '../selection'

/** The pond every fixture here swims in. */
const POND = describePond(1200, 800, 1200, 800, false)

/** An outline lying along +x with its nose at 400, 300. */
const OUTLINE: KoiOutline = {
  framework: 'lit',
  spine: [
    { x: 400, y: 300 },
    { x: 350, y: 300 },
    { x: 300, y: 300 },
  ],
  girth: [8, 14, 5],
  heading: 0,
  speed: 60,
  depth: 3,
  phase: 'relaxed',
}

/**
 * Builds a root with one layer per framework the fixture cares about.
 *
 * @returns The root, the layer map, and the chrome under test.
 */
function harness() {
  const root = document.createElement('div')
  const layers = new Map<KoiFramework, HTMLElement>()
  const layer = document.createElement('div')
  layers.set('lit', layer)
  root.append(layer)
  const chrome = createSelectionChrome(root, layers)
  return { root, layer, chrome }
}

describe('the ring', () => {
  it('rises inside the held fish layer so depth restacks carry it along', () => {
    const { layer, chrome } = harness()
    chrome.hold('lit')
    expect(layer.querySelector('.koi-select-ring')).not.toBeNull()
  })

  it('never doubles up however many times the same koi is held', () => {
    const { layer, chrome } = harness()
    chrome.hold('lit')
    chrome.hold('lit')
    expect(layer.querySelectorAll('.koi-select-ring')).toHaveLength(1)
  })

  it('leaves with the release', () => {
    const { layer, chrome } = harness()
    chrome.hold('lit')
    chrome.release('lit')
    expect(layer.querySelector('.koi-select-ring')).toBeNull()
  })

  it('fits around the body with a pad, in view coordinates', () => {
    const { layer, chrome } = harness()
    chrome.hold('lit')
    chrome.track('lit', OUTLINE, POND)
    const ring = layer.querySelector<HTMLElement>('.koi-select-ring')
    const pad = POND.fishLength * 0.1
    // why: The body spans x 295..408 and y 286..314 once girth is counted; the ring wraps that box plus its pad, slid 0.355 chord lengths along the heading because the drawn pixels lead the reported spine by the pivot anchor.
    expect(ring?.style.width).toBe(`${(113 + pad * 2).toFixed(1)}px`)
    expect(ring?.style.height).toBe(`${(28 + pad * 2).toFixed(1)}px`)
    expect(ring?.style.transform).toContain(`${(295 + 35.5 - pad - POND.view.x).toFixed(1)}px`)
    expect(ring?.hasAttribute('data-shown')).toBe(true)
  })

  it('hides rather than guessing when the outline carries no spine', () => {
    const { layer, chrome } = harness()
    chrome.hold('lit')
    chrome.track('lit', { ...OUTLINE, spine: [], girth: [] }, POND)
    expect(layer.querySelector<HTMLElement>('.koi-select-ring')?.hasAttribute('data-shown')).toBe(false)
  })
})

describe('the card link', () => {
  it('starts hidden', () => {
    const { root } = harness()
    expect(root.querySelector<HTMLAnchorElement>('.koi-card-link')?.hidden).toBe(true)
  })

  it('floats over the reported rectangle as an ordinary new-tab anchor', () => {
    const { root, chrome } = harness()
    chrome.placeLink({ x: 500, y: 200, width: 180, height: 14 }, 'https://pond.test/fish-lit/', POND)
    const link = root.querySelector<HTMLAnchorElement>('.koi-card-link')
    expect(link?.hidden).toBe(false)
    expect(link?.href).toBe('https://pond.test/fish-lit/')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toBe('noopener noreferrer')
    expect(link?.style.transform).toContain(`${(500 - POND.view.x).toFixed(1)}px`)
    expect(link?.style.width).toBe('180px')
  })

  it('hides again the moment there is nothing to link', () => {
    const { root, chrome } = harness()
    chrome.placeLink({ x: 500, y: 200, width: 180, height: 14 }, 'https://pond.test/fish-lit/', POND)
    chrome.placeLink(null, null, POND)
    expect(root.querySelector<HTMLAnchorElement>('.koi-card-link')?.hidden).toBe(true)
  })

  it('takes everything down on dispose', () => {
    const { root, layer, chrome } = harness()
    chrome.hold('lit')
    chrome.dispose()
    expect(layer.querySelector('.koi-select-ring')).toBeNull()
    expect(root.querySelector('.koi-card-link')).toBeNull()
  })
})
