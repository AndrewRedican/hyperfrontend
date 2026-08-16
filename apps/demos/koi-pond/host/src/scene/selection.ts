/**
 * The host-side chrome that makes a held koi's card interactive.
 *
 * A koi paints its own identity card inside its pointer-transparent frame, so
 * nothing it draws can take a click. While a visitor holds a koi, the host
 * floats four invisible pieces over the card the fish reports: real anchors
 * over the app URL, the framework's website line, and the app's source line,
 * plus an inert shield over the rest of the card — so moving off the fish and into the card clicks
 * links instead of striking the water behind them. The selection visual itself
 * lives in the fish's own renderer as a silhouette trace; the host draws no
 * shape of its own.
 */
import type { KoiCardLink, KoiCardPanel, KoiFramework, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import { FRAMEWORK_SITES, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'

/** The pieces floated over one held koi's card. */
interface CardChrome {
  shield: HTMLElement
  app: HTMLAnchorElement
  site: HTMLAnchorElement
  source: HTMLAnchorElement
}

/** The host chrome around held koi. */
export interface SelectionChrome {
  /**
   * Raises the card chrome for a koi, hidden until its card reports geometry.
   *
   * @param framework - Which koi was held.
   * @param appUrl - The koi's own application URL.
   */
  hold(framework: KoiFramework, appUrl: string): void
  /**
   * Removes a koi's card chrome.
   *
   * @param framework - Which koi was released.
   */
  release(framework: KoiFramework): void
  /**
   * Moves the chrome onto the card's reported geometry, or hides it.
   *
   * @param framework - Whose chrome to move.
   * @param panel - Where the card and its links sit, or `null` to hide.
   * @param pond - The announced world, for the view origin.
   */
  trackCard(framework: KoiFramework, panel: KoiCardPanel | null, pond: PondEnvironment): void
  /** Removes every piece of chrome. */
  dispose(): void
}

/**
 * Places one absolutely-positioned piece over a pond-space rectangle.
 *
 * @param element - The piece to place.
 * @param rect - The pond-space rectangle.
 * @param pond - The announced world, for the view origin.
 */
function place(element: HTMLElement, rect: KoiCardLink, pond: PondEnvironment): void {
  element.style.width = `${rect.width.toFixed(1)}px`
  element.style.height = `${rect.height.toFixed(1)}px`
  element.style.transform = `translate3d(${(rect.x - pond.view.x).toFixed(1)}px, ${(rect.y - pond.view.y).toFixed(1)}px, 0)`
  element.hidden = false
}

/**
 * Keeps a press on the card from falling through to the pond.
 *
 * @param event - The event to contain.
 */
function contain(event: Event): void {
  // why: The card floats over open water — without this, clicking a link would also bubble into the pond's press handling and strike the very water the visitor is reading over.
  event.stopPropagation()
}

/**
 * Creates the selection chrome.
 *
 * @param root - The pond root the chrome floats in.
 * @returns The chrome.
 *
 * @example Following a held koi's card from the frame loop
 * ```typescript
 * chrome.hold(framework, fishHomeUrl(framework))
 * chrome.trackCard(framework, outline.card ?? null, pond)
 * ```
 */
export function createSelectionChrome(root: HTMLElement): SelectionChrome {
  const held = new Map<KoiFramework, CardChrome>()

  const anchor = (href: string, label: string): HTMLAnchorElement => {
    const link = document.createElement('a')
    link.className = 'koi-card-link'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.href = href
    link.setAttribute('aria-label', label)
    link.hidden = true
    link.addEventListener('pointerdown', contain)
    link.addEventListener('click', contain)
    return link
  }

  return {
    hold(framework, appUrl) {
      if (held.has(framework)) {
        return
      }
      const shield = document.createElement('div')
      shield.className = 'koi-card-shield'
      shield.hidden = true
      shield.addEventListener('pointerdown', contain)
      shield.addEventListener('click', contain)
      const app = anchor(appUrl, 'Open this fish app in a new tab')
      const site = anchor(FRAMEWORK_SITES[framework], "Open this framework's website in a new tab")
      const source = anchor(koiSourceUrl(framework), "Open this fish app's source code in a new tab")
      root.append(shield, app, site, source)
      held.set(framework, { shield, app, site, source })
    },

    release(framework) {
      const chrome = held.get(framework)
      if (chrome === undefined) {
        return
      }
      chrome.shield.remove()
      chrome.app.remove()
      chrome.site.remove()
      chrome.source.remove()
      held.delete(framework)
    },

    trackCard(framework, panel, pond) {
      const chrome = held.get(framework)
      if (chrome === undefined) {
        return
      }
      if (panel === null) {
        chrome.shield.hidden = true
        chrome.app.hidden = true
        chrome.site.hidden = true
        chrome.source.hidden = true
        return
      }
      place(chrome.shield, panel.frame, pond)
      place(chrome.app, panel.app, pond)
      place(chrome.site, panel.site, pond)
      // why: The panel crosses the schema-less outline, so a shell packed before the source line existed simply reports none — the anchor stays hidden rather than covering water.
      const source: KoiCardLink | undefined = panel.source
      if (source === undefined) {
        chrome.source.hidden = true
      } else {
        place(chrome.source, source, pond)
      }
    },

    dispose() {
      for (const chrome of held.values()) {
        chrome.shield.remove()
        chrome.app.remove()
        chrome.site.remove()
        chrome.source.remove()
      }
      held.clear()
    },
  }
}
