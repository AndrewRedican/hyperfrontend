/**
 * The seam between this app's frame loop and its Angular application.
 *
 * The loop never touches the DOM and never learns that Angular is here: it
 * drives the {@link KoiRenderer} this module hands back, and the mounted koi
 * decides what that means on screen. Bootstrapping is the only render this
 * module asks for, and it is deliberately not waited on — `createApplication`
 * resolves asynchronously, so the first frames may well be drawn at a stage
 * that does not exist yet. They are not lost: the stage is built from the
 * latest pond the moment Angular commits the view, and the very next frame
 * paints onto it.
 */
import type { ApplicationRef } from '@angular/core'
import type {
  KoiCardDetails,
  KoiCardLink,
  KoiCardPanel,
  KoiProfile,
  KoiRenderer,
  KoiState,
  PondEnvironment,
} from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer, KoiStage } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiCardHandles, KoiMount } from './koi-fish'
import { createComponent, provideZonelessChangeDetection } from '@angular/core'
import { createApplication } from '@angular/platform-browser'
import { cardAnchor, cardTransform, describeKoiCard } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { KoiFish } from './koi-fish'

/** How firmly the silhouette reads when the pointer is merely over the koi. */
const HOVER_OUTLINE = 0.35

/** How firmly the silhouette reads while a visitor holds the koi. */
const HELD_OUTLINE = 1

/**
 * Bootstraps the koi's canvas and scene into a root element.
 *
 * @param root - The app root the koi is drawn into.
 * @param profile - Everything about this koi that never changes.
 * @param url - The URL of the app rendering it, shown on the card.
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
  // why: The stage and the card's nodes arrive when Angular commits the view and leave when it is destroyed, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let handles: KoiCardHandles | null = null
  let latestPond = pond
  let hovered = false
  let selected = false
  let disposed = false

  // why: Angular takes the element it is handed as its component's host and takes that element out of the document when the application is destroyed. The app root is the page's, not this renderer's, and it is handed back to a fresh renderer every time the koi wakes or adopts a dealt seed — so Angular is given a node this module made instead, and the root outlives every rebuild the way the other seven frameworks' roots do. `display: contents` keeps it out of the layout, so the canvas and the card still position against the root itself.
  const host = document.createElement('div')
  host.style.display = 'contents'
  root.append(host)

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  const applyOutline = (): void => {
    stage?.setOutline(selected ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
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
    return { x: rect.left + latestPond.view.x, y: rect.top + latestPond.view.y, width: rect.width, height: rect.height }
  }

  const mount: KoiMount = (canvas, cardHandles) => {
    // why: A pond may have been announced while the view was still mounting, so the stage is built from the latest one rather than the one this closure was born with.
    const built = createKoiStage(canvas, profile, latestPond, createGl)
    stage = built
    handles = cardHandles
    // why: A hover or hold may equally have arrived while the view was still mounting, so the fresh nodes take the flags this renderer already carries.
    cardHandles.card.hidden = !selected
    applyOutline()
    return () => {
      built.dispose()
      stage = null
      handles = null
    }
  }

  // why: The application runs zoneless — every per-frame mutation goes through the imperative stage, so nothing here ever needs a change-detection sweep after the first.
  const application: Promise<ApplicationRef> = createApplication({ providers: [provideZonelessChangeDetection()] }).then((app) => {
    const component = createComponent(KoiFish, { environmentInjector: app.injector, hostElement: host })
    component.setInput('profile', profile)
    component.setInput('url', url)
    component.setInput('mount', mount)
    app.attachView(component.hostView)
    // why: A zoneless app schedules its first render; ticking here commits the canvas now, so at most a frame or two is skipped before the stage exists.
    app.tick()
    // why: Disposal may have been asked for while bootstrapping was still in flight; honouring it here keeps the GPU handle from outliving its page.
    if (disposed) {
      app.destroy()
    }
    return app
  })

  return {
    draw(state: KoiState, dt: number) {
      stage?.draw(state, dt)
    },

    setPond(next) {
      latestPond = next
      stage?.setPond(next)
    },

    setHovered(next) {
      hovered = next
      applyOutline()
    },

    setSelected(next) {
      selected = next
      // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
      if (handles !== null) {
        handles.card.hidden = !next
      }
      applyOutline()
    },

    updateCard(details: KoiCardDetails) {
      if (handles === null) {
        return
      }
      const rows = describeKoiCard(details)
      handles.state.textContent = rows.state
      handles.runtime.textContent = rows.runtime
      handles.memory.textContent = rows.memory
      handles.event.hidden = rows.event === null
      handles.event.textContent = rows.event ?? ''
    },

    placeCard(state) {
      if (handles !== null) {
        // why: A card that has not laid out yet still needs a footprint to clamp against, so nominal dimensions stand in until the browser has measured it.
        const size = { width: handles.card.offsetWidth || 200, height: handles.card.offsetHeight || 64 }
        handles.card.style.transform = cardTransform(cardAnchor(state, latestPond, size))
      }
    },

    cardRects(): KoiCardPanel | null {
      if (handles === null || handles.card.hidden) {
        return null
      }
      return { frame: rectOf(handles.card), app: rectOf(handles.app), site: rectOf(handles.site), source: rectOf(handles.source) }
    },

    dispose() {
      disposed = true
      // why: Destroying the application runs the component's teardown, which releases the GPU handle. Angular usually takes the host node with it; removing it here covers the case where it does not, and touches nothing a renderer built since — this module owns exactly the node it made.
      void application.then((app) => {
        if (!app.destroyed) {
          app.destroy()
        }
        host.remove()
      })
    },
  }
}
