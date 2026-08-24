/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { KOI_CONTRACT_VERSION } from '../../contract/koi-fish.contract.js'
import { koiProfile } from '../../model/traits.js'
import { FRAMEWORK_SITES, KOI_FRAMEWORKS, koiSourceUrl } from '../../model/types.js'
import { frameworkMark } from '../framework-mark.js'
import { mountSoloPage } from '../solo-page.js'

/** Where a fish app framed by the pond is served from. */
const UNDER_A_POND = 'https://pond.example/fish-react/'

/** Where a fish app served at the root of its own origin is. */
const ITS_OWN_ORIGIN = 'https://react-koi.example/'

/** Every teardown a spec has taken out, so no page is left dressed for the next one. */
const opened: (() => void)[] = []

/**
 * Dresses a page and remembers how to take it down again.
 *
 * @param framework - Which koi's page to dress.
 * @param url - Where the app is served.
 * @returns The teardown.
 */
function dressed(framework: (typeof KOI_FRAMEWORKS)[number] = 'react', url: string = UNDER_A_POND) {
  const undress = mountSoloPage({ profile: koiProfile(framework), url })
  opened.push(undress)
  return undress
}

/**
 * The text one selector holds.
 *
 * @param selector - What to read.
 * @returns Its text, or an empty string when nothing matched.
 */
function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? ''
}

afterEach(() => {
  for (const undress of opened.splice(0)) {
    undress()
  }
})

describe('mountSoloPage', () => {
  it('paints water behind everything already on the page', () => {
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    dressed()
    // why: The koi's own canvas takes no stacking order of its own, so the sky can only stay behind it by going in front of it in the document.
    expect(document.body.firstElementChild?.className).toBe('koi-solo-sky')
    expect(document.querySelector('.koi-solo-sky')?.compareDocumentPosition(canvas)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    canvas.remove()
  })

  it('names the framework that drew this koi and the variety it wears', () => {
    dressed('vue')
    expect(textOf('.koi-solo-framework')).toBe(koiProfile('vue').label)
    expect(textOf('.koi-solo-variety')).toBe(`${koiProfile('vue').palette.pattern} koi`)
  })

  it('tints the mark with the brand colour the koi carries on its back', () => {
    dressed('svelte')
    const mark = document.querySelector<SVGElement>('.koi-solo-mark')
    // why: A browser rewrites a colour it is given into its own spelling, so the accent is compared as that same browser writes it rather than as the palette states it.
    const spelt = document.createElement('span')
    spelt.style.color = koiProfile('svelte').palette.accent
    expect(mark?.style.color).toBe(spelt.style.color)
    expect(mark?.style.color).not.toBe('')
    // how: A browser rewrites the markup it parses as well as the colour, so the mark is compared against the same markup parsed the same way, in the same namespace.
    const drawn = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    drawn.innerHTML = frameworkMark('svelte')
    expect(mark?.innerHTML).toBe(drawn.innerHTML)
  })

  it('says what the koi is speaking and what draws it', () => {
    dressed()
    expect(textOf('.koi-solo-facts')).toContain(`koi-fish ${KOI_CONTRACT_VERSION}`)
    expect(textOf('.koi-solo-facts')).toContain('three.js')
  })

  it('links out to the framework, to this app, and to the pond it is served under', () => {
    dressed('react', UNDER_A_POND)
    const links = [...document.querySelectorAll('.koi-solo-links a')].map((anchor) => anchor.getAttribute('href'))
    expect(links).toEqual([FRAMEWORK_SITES.react, koiSourceUrl('react'), 'https://pond.example/'])
  })

  it('opens every link it offers in a page of its own', () => {
    dressed()
    for (const anchor of document.querySelectorAll('.koi-solo-links a')) {
      expect([anchor.getAttribute('target'), anchor.getAttribute('rel')]).toEqual(['_blank', 'noopener noreferrer'])
    }
  })

  it('offers no pond to an app that is the root of its own origin', () => {
    dressed('react', ITS_OWN_ORIGIN)
    // why: `..` on a root resolves to that same root, and a link back to the page a visitor is already on says nothing.
    const links = [...document.querySelectorAll('.koi-solo-links a')].map((anchor) => anchor.getAttribute('href'))
    expect(links).toEqual([FRAMEWORK_SITES.react, koiSourceUrl('react')])
  })

  it('leaves the page exactly as bare as it found it', () => {
    const before = document.body.innerHTML
    const heads = document.head.childElementCount
    dressed().call(null)
    expect(document.body.innerHTML).toBe(before)
    expect(document.head.childElementCount).toBe(heads)
  })

  it('dresses a page for every koi in the pond', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const undress = mountSoloPage({ profile: koiProfile(framework), url: UNDER_A_POND })
      expect(textOf('.koi-solo-framework')).toBe(koiProfile(framework).label)
      // why: A framework left out of either table would dress a page with an empty mark or an empty account of itself, which reads as a broken page rather than a missing entry.
      expect(document.querySelector('.koi-solo-mark')?.innerHTML.length).toBeGreaterThan(40)
      expect(textOf('.koi-solo-how').length).toBeGreaterThan(40)
      undress()
    }
  })
})
