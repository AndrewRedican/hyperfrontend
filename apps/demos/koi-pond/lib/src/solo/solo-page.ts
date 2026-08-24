/**
 * The page a koi dresses for itself when nothing is hosting it.
 *
 * Framed by the pond, this app is deliberately bare: the SDK resets the page to
 * transparent, and anything painted here would blank the water behind it for
 * every koi below. Opened on its own, that same restraint leaves a visitor a
 * fish swimming on nothing, with no way to tell which of the eight apps they
 * are looking at or what they are looking at it for. So a koi that has been
 * told it is top-level paints its own water and says who drew it: the framework
 * behind this one animal, what the app actually is, and the way on to the
 * framework, to this app's source, and to the pond that composes all eight.
 *
 * None of it is mounted unless the app states it is top-level. The flag comes
 * from the SDK handle rather than from the window above the frame, and a pond
 * announcing a world later takes the page straight back down.
 */
import type { KoiFramework, KoiProfile } from '../model/types.js'
import { KOI_CONTRACT_VERSION } from '../contract/koi-fish.contract.js'
import { FRAMEWORK_SITES, koiSourceUrl } from '../model/types.js'
import { MARK_VIEW_BOX, frameworkMark } from './framework-mark.js'

/** What this app is, wherever it is opened. */
const WHAT_THIS_IS =
  'This page is one feature app of the koi pond: a whole browser application whose only job is to be a single fish. ' +
  'Here it swims in water of its own. Framed by the pond it is one of eight, each drawn by a different framework in ' +
  'its own document with its own renderer, each told about its neighbours over the same wire contract.'

/** How each framework mounts and drives its koi, in the terms its own app is written in. */
const FRAMEWORK_NOTES: Readonly<Record<KoiFramework, string>> = {
  vanilla:
    'No framework at all. The canvas and the identity card are built straight onto the DOM, and the shared stage draws the animal into them.',
  react:
    'A React root that renders once. The tree commits the canvas, and every frame after that is written imperatively, outside the render cycle.',
  vue: 'A single-file component mounted with createApp. It hands an imperative handle up from onMounted, and the loop drives that rather than re-rendering.',
  svelte: 'A compiled component that owns the canvas and the card, and exports imperative handles for everything that changes per frame.',
  solid:
    'Rendered once, synchronously, with no virtual DOM. Only the card rows and the hold go through signals; the per-frame transform is written straight to the node.',
  preact:
    "React's API in a fraction of the runtime. The tree commits and flushes its layout effect before render returns, so the stage is live the moment it is asked for.",
  lit: 'A custom element with a shadow root, so the koi is a real tag on the page. Its canvas is mounted imperatively, because the runtime takes that drawing surface back every time the koi sleeps.',
  angular:
    'A zoneless standalone component, created imperatively and rendered exactly once. Everything that moves per frame goes through the stage, outside change detection.',
}

/** The page's own styles, carried here so a koi dresses itself whatever stylesheet its app ships. */
const SOLO_STYLES = `
.koi-solo-sky {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(130% 100% at 50% -10%, #1d5049 0%, #14352f 42%, #0a1c1a 100%);
}

.koi-solo {
  position: fixed;
  top: clamp(0.9rem, 4vh, 2.6rem);
  left: clamp(0.9rem, 4vw, 2.6rem);
  z-index: 2;
  display: grid;
  gap: 0.72rem;
  max-width: min(26rem, calc(100vw - 1.8rem));
  padding: 1.05rem 1.2rem;
  border: 1px solid rgba(232, 243, 239, 0.14);
  border-radius: 14px;
  background: rgba(9, 24, 22, 0.72);
  backdrop-filter: blur(8px);
  color: rgba(232, 243, 239, 0.82);
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.koi-solo-eyebrow {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  color: rgba(232, 243, 239, 0.42);
}

.koi-solo-head {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.koi-solo-mark {
  flex: none;
  width: 2.3rem;
  height: 2.3rem;
}

.koi-solo-name {
  display: grid;
  gap: 0.1rem;
}

.koi-solo-framework {
  font-size: 1.45rem;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: #eff8f5;
}

.koi-solo-variety {
  font-size: 0.63rem;
  font-style: italic;
  color: rgba(232, 243, 239, 0.5);
}

.koi-solo-note,
.koi-solo-how {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.55;
}

.koi-solo-how {
  color: rgba(232, 243, 239, 0.62);
}

.koi-solo-facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.22rem 0.85rem;
  margin: 0;
  font-size: 0.68rem;
}

.koi-solo-facts dt {
  color: rgba(232, 243, 239, 0.42);
}

.koi-solo-facts dd {
  margin: 0;
  color: rgba(232, 243, 239, 0.78);
  font-family: ui-monospace, 'SFMono-Regular', monospace;
}

.koi-solo-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.9rem;
  font-size: 0.7rem;
}

.koi-solo-links a {
  color: rgba(124, 192, 255, 0.9);
  text-decoration: underline;
  text-decoration-color: rgba(124, 192, 255, 0.45);
  text-underline-offset: 2px;
}

@media (max-width: 540px) {
  .koi-solo {
    gap: 0.55rem;
    padding: 0.85rem 0.95rem;
  }

  .koi-solo-how {
    display: none;
  }
}
`

/** Everything the page a koi dresses for itself is built from. */
export interface SoloPageInit {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app drawing it. */
  url: string
}

/**
 * A row of the page's facts.
 *
 * @param term - What the row is about.
 * @param value - What it says.
 * @returns The pair, for appending to the list.
 */
function fact(term: string, value: string): readonly HTMLElement[] {
  const label = document.createElement('dt')
  label.textContent = term
  const said = document.createElement('dd')
  said.textContent = value
  return [label, said]
}

/**
 * A link out of the page.
 *
 * @param text - What the link reads.
 * @param href - Where it goes.
 * @returns The anchor.
 */
function link(text: string, href: string): HTMLAnchorElement {
  const anchor = document.createElement('a')
  anchor.textContent = `${text} ↗`
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  return anchor
}

/**
 * The pond this app is served under, when it is served under one.
 *
 * @param url - The URL of the app drawing the koi.
 * @returns The pond's URL, or `null` when this app is the root of its own origin.
 */
function pondAbove(url: string): string | null {
  const above = new URL('..', url).href
  // why: A fish served at the root of its own origin has nothing above it, and `..` on a root resolves to that same root rather than to a pond.
  return above === url ? null : above
}

/**
 * Dresses the page a koi was opened on, and hands back its teardown.
 *
 * @param init - The koi's profile and the URL of the app drawing it.
 * @returns A teardown that takes the page back to the bare frame the pond expects.
 *
 * @example Dressing the page only when nothing is hosting the app
 * ```typescript
 * const undress = hosted ? null : mountSoloPage({ profile, url })
 * ```
 */
export function mountSoloPage(init: SoloPageInit): () => void {
  const { profile, url } = init
  const { palette } = profile

  const style = document.createElement('style')
  style.textContent = SOLO_STYLES

  const sky = document.createElement('div')
  sky.className = 'koi-solo-sky'

  const panel = document.createElement('aside')
  panel.className = 'koi-solo'

  const eyebrow = document.createElement('span')
  eyebrow.className = 'koi-solo-eyebrow'
  eyebrow.textContent = 'hyperfrontend · koi pond'

  const head = document.createElement('div')
  head.className = 'koi-solo-head'
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  mark.setAttribute('class', 'koi-solo-mark')
  mark.setAttribute('viewBox', MARK_VIEW_BOX)
  mark.setAttribute('aria-hidden', 'true')
  // why: The mark is a constant this module owns rather than anything a page or a wire supplied, and the brand colour it is tinted with is the same one the koi wears on its back.
  mark.innerHTML = frameworkMark(profile.framework)
  mark.style.color = palette.accent

  const name = document.createElement('div')
  name.className = 'koi-solo-name'
  const framework = document.createElement('span')
  framework.className = 'koi-solo-framework'
  framework.textContent = profile.label
  const variety = document.createElement('span')
  variety.className = 'koi-solo-variety'
  variety.textContent = `${palette.pattern} koi`
  name.append(framework, variety)
  head.append(mark, name)

  const note = document.createElement('p')
  note.className = 'koi-solo-note'
  note.textContent = WHAT_THIS_IS

  const how = document.createElement('p')
  how.className = 'koi-solo-how'
  how.textContent = FRAMEWORK_NOTES[profile.framework]

  const facts = document.createElement('dl')
  facts.className = 'koi-solo-facts'
  facts.append(
    ...fact('Contract', `koi-fish ${KOI_CONTRACT_VERSION}`),
    ...fact('Renderer', 'three.js, one WebGL context'),
    ...fact('Hosting', 'none: this koi is top-level')
  )

  const links = document.createElement('nav')
  links.className = 'koi-solo-links'
  links.append(link(`${profile.label} website`, FRAMEWORK_SITES[profile.framework]), link('App source', koiSourceUrl(profile.framework)))
  const pond = pondAbove(url)
  if (pond !== null) {
    links.append(link('The whole pond', pond))
  }

  panel.append(eyebrow, head, note, how, facts, links)
  document.head.append(style)
  // why: The sky goes in front of everything already on the page so that everything already on the page — the koi's own canvas above all — keeps painting over it without either needing a stacking order of its own.
  document.body.prepend(sky)
  document.body.append(panel)

  return () => {
    style.remove()
    sky.remove()
    panel.remove()
  }
}
