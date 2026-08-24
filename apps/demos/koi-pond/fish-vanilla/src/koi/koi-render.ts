/**
 * The vanilla renderer: one 3D koi, drawn through the shared stage.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the fish
 * itself has colour.
 *
 * This is the one browser-facing module in the app. The other seven koi replace
 * exactly this file with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * this module only makes the koi's body express it — the canvas and card DOM
 * are built directly, and the shared stage draws the animal into them.
 */
import type {
  KoiCardDetails,
  KoiCardLink,
  KoiCardPanel,
  KoiProfile,
  KoiRenderer,
  KoiState,
  PondEnvironment,
} from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { FRAMEWORK_SITES, cardAnchor, cardTransform, describeKoiCard, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'

/** How firmly the silhouette reads when the pointer is merely over the koi. */
const HOVER_OUTLINE = 0.35

/** How firmly the silhouette reads while a visitor holds the koi. */
const HELD_OUTLINE = 1

/**
 * Builds the koi's canvas and scene inside a root element.
 *
 * @param root - The app root the koi is drawn into.
 * @param profile - Everything about this koi that never changes.
 * @param url - The URL of the app rendering it, revealed on hover.
 * @param pond - The world at build time; later announcements arrive via `setPond`.
 * @param createGl - The GL factory, replaceable so specs can run headless.
 * @returns The renderer.
 *
 * @example Drawing a koi each frame
 * ```typescript
 * const renderer = createKoiRenderer(root, profile, window.location.href, pond)
 * renderer.draw(motion.state, dt)
 * ```
 */
export function createKoiRenderer(
  root: HTMLElement,
  profile: KoiProfile,
  url: string,
  pond: PondEnvironment,
  createGl: (canvas: HTMLCanvasElement) => GlRenderer = createPondRenderer
): KoiRenderer {
  const { palette } = profile

  const canvas = document.createElement('canvas')
  canvas.className = 'koi-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const card = document.createElement('div')
  card.className = 'koi-card'
  card.hidden = true
  // why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them.
  card.innerHTML =
    `<span class="koi-card-name"></span><span class="koi-card-line koi-card-state"></span>` +
    `<a class="koi-card-url" target="_blank" rel="noopener noreferrer"></a>` +
    `<span class="koi-card-line koi-card-runtime"></span><span class="koi-card-line koi-card-memory"></span>` +
    `<span class="koi-card-line koi-card-event" hidden></span>` +
    `<a class="koi-card-site" target="_blank" rel="noopener noreferrer"></a>` +
    `<a class="koi-card-source" target="_blank" rel="noopener noreferrer"></a>`
  const cardName = card.querySelector<HTMLElement>('.koi-card-name')
  const cardUrl = card.querySelector<HTMLAnchorElement>('.koi-card-url')
  const cardState = card.querySelector<HTMLElement>('.koi-card-state')
  const cardRuntime = card.querySelector<HTMLElement>('.koi-card-runtime')
  const cardMemory = card.querySelector<HTMLElement>('.koi-card-memory')
  const cardEvent = card.querySelector<HTMLElement>('.koi-card-event')
  const cardSite = card.querySelector<HTMLAnchorElement>('.koi-card-site')
  const cardSource = card.querySelector<HTMLAnchorElement>('.koi-card-source')
  if (cardName !== null) {
    // why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app.
    cardName.innerHTML = `<span class="koi-card-title"></span><span class="koi-card-variety"></span>`
    const title = cardName.querySelector<HTMLElement>('.koi-card-title')
    const variety = cardName.querySelector<HTMLElement>('.koi-card-variety')
    if (title !== null) {
      title.textContent = profile.label
      title.style.color = palette.accent
    }
    if (variety !== null) {
      variety.textContent = palette.pattern
    }
  }
  if (cardUrl !== null) {
    cardUrl.textContent = url
    cardUrl.href = url
  }
  if (cardSite !== null) {
    const site = FRAMEWORK_SITES[profile.framework]
    cardSite.textContent = `${profile.label} website ↗`
    cardSite.href = site
  }
  if (cardSource !== null) {
    // why: The demo's claim is checkable — the card links straight to this very app's implementation in the repository.
    cardSource.textContent = 'App source ↗'
    cardSource.href = koiSourceUrl(profile.framework)
  }

  root.append(canvas, card)

  const stage = createKoiStage(canvas, profile, pond, createGl)

  let current = pond
  let hovered = false
  let selected = false

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  const applyOutline = (): void => {
    stage.setOutline(selected ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
  }

  /**
   * A card element's rectangle lifted into pond space.
   *
   * @param element - The element to measure.
   * @returns The pond-space rectangle.
   */
  const rectOf = (element: HTMLElement): KoiCardLink => {
    // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
    const rect = element.getBoundingClientRect()
    return { x: rect.left + current.view.x, y: rect.top + current.view.y, width: rect.width, height: rect.height }
  }

  return {
    draw(state: KoiState, dt: number) {
      stage.draw(state, dt)
    },

    setPond(next) {
      current = next
      stage.setPond(next)
    },

    setHovered(next) {
      hovered = next
      applyOutline()
    },

    setSelected(next) {
      selected = next
      // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
      card.hidden = !next
      applyOutline()
    },

    updateCard(details: KoiCardDetails) {
      const rows = describeKoiCard(details)
      if (cardState !== null) {
        cardState.textContent = rows.state
      }
      if (cardRuntime !== null) {
        cardRuntime.textContent = rows.runtime
      }
      if (cardMemory !== null) {
        cardMemory.textContent = rows.memory
      }
      if (cardEvent !== null) {
        cardEvent.hidden = rows.event === null
        cardEvent.textContent = rows.event ?? ''
      }
    },

    placeCard(state: KoiState) {
      // why: A hidden card measures nothing, so a nominal footprint keeps the window clamp honest on the very first placement.
      const at = cardAnchor(state, current, { width: card.offsetWidth || 200, height: card.offsetHeight || 64 })
      card.style.transform = cardTransform(at)
    },

    cardRects(): KoiCardPanel | null {
      if (card.hidden || cardUrl === null || cardSite === null || cardSource === null) {
        return null
      }
      return { frame: rectOf(card), app: rectOf(cardUrl), site: rectOf(cardSite), source: rectOf(cardSource) }
    },

    dispose() {
      stage.dispose()
      canvas.remove()
      card.remove()
    },
  }
}
