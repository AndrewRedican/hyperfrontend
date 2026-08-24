/**
 * The imperative side of the Lit koi: one 3D fish drawn through the shared
 * stage, sixty times a second.
 *
 * Lit's reactive update is the wrong tool at that cadence, so nothing here
 * asks the element to re-render. `<koi-fish>` owns what is declarative: the
 * identity card and its text exist because its template says so. This module
 * conforms that card, plus a canvas it mounts itself, to the shared runtime's
 * drawing seam: the shared stage draws the animal, the shared anchor parks
 * the card, and the inspector rows are rewritten from the shared card story.
 *
 * The canvas is built here rather than in the template because its lifetime
 * is not the element's: the runtime hands the drawing surface back on every
 * stand-down and asks for a fresh one on every wake, so each renderer mounts
 * its own canvas and removes it on dispose.
 *
 * Nothing is painted on `body` or on the host element: the hostee SDK resets
 * the page to transparent, and anything painted there would blank the pond
 * behind this frame for every koi below it. The canvas clears to transparent;
 * only the fish itself has colour.
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
import { cardAnchor, cardTransform, describeKoiCard } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'

/** How firmly the silhouette reads when the pointer is merely over the koi. */
const HOVER_OUTLINE = 0.35

/** How firmly the silhouette reads while a visitor holds the koi. */
const HELD_OUTLINE = 1

/**
 * Builds the koi's canvas and scene behind the card the element's template rendered.
 *
 * @param stageRoot - The element's render root, holding the template's card.
 * @param profile - Everything about this koi that never changes.
 * @param pond - The world at build time; later announcements arrive via `setPond`.
 * @param createGl - The GL factory, replaceable so specs can run headless.
 * @returns The renderer.
 *
 * @example Drawing a koi each frame
 * ```typescript
 * const renderer = createKoiRenderer(element.renderRoot, profile, pond)
 * renderer.draw(motion.state, dt)
 * ```
 */
export function createKoiRenderer(
  stageRoot: HTMLElement | DocumentFragment,
  profile: KoiProfile,
  pond: PondEnvironment,
  createGl: (canvas: HTMLCanvasElement) => GlRenderer = createPondRenderer
): KoiRenderer {
  const card = stageRoot.querySelector<HTMLElement>('.koi-card')
  if (card === null) {
    throw new Error('missing stage: the koi template rendered without its card')
  }
  // why: The card's markup belongs to the element's template; its anchors and rows are looked up per build so the inspector can rewrite the rows and each outline can report the card's geometry.
  const cardUrl = card.querySelector<HTMLAnchorElement>('.koi-card-url')
  const cardState = card.querySelector<HTMLElement>('.koi-card-state')
  const cardRuntime = card.querySelector<HTMLElement>('.koi-card-runtime')
  const cardMemory = card.querySelector<HTMLElement>('.koi-card-memory')
  const cardEvent = card.querySelector<HTMLElement>('.koi-card-event')
  const cardSite = card.querySelector<HTMLAnchorElement>('.koi-card-site')
  const cardSource = card.querySelector<HTMLAnchorElement>('.koi-card-source')

  const canvas = document.createElement('canvas')
  canvas.className = 'koi-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  // why: The canvas mounts before the card so the card always paints above the fish; removing it on dispose is what actually hands the GL context and its drawing buffers back while the koi is stood down.
  card.before(canvas)

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
      // note: The card belongs to the element's template, so it is hidden rather than removed; the next renderer finds it where the template left it.
      card.hidden = true
    },
  }
}
