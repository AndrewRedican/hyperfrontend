/**
 * The koi roster: hover identity for anyone not using a pointer.
 *
 * Hovering a fish reveals which framework renders it and where its app lives.
 * That is a pointer gesture over a moving target inside a frame that cannot be
 * hit-tested by assistive technology — so the same information is published as
 * an ordinary list the keyboard can walk and a screen reader can read.
 *
 * Focusing a row is the keyboard's hover: the host sends that koi the same
 * `hover` notice a pointer would, and the fish draws its own identity exactly
 * as it does for a mouse. The roster is not a description of the scene; it is
 * another way into it.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import { KOI_FRAMEWORKS, koiLabel } from '@hyperfrontend/demo-koi-lib'

/** Where the pond's source lives, linked from the roster for anyone who wants to read the trick. */
const SOURCE_URL = 'https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/demos/koi-pond'

/** The accessible roster of koi. */
export interface KoiRoster {
  /** The list element, already in the document. */
  element: HTMLElement
  /**
   * Marks a koi as connected or not, so the roster never offers a fish that is not there.
   *
   * @param framework - Which koi.
   * @param connected - Whether its session is open.
   */
  setConnected(framework: KoiFramework, connected: boolean): void
  /**
   * Reflects the pointer's current pick, so mouse and keyboard agree.
   *
   * @param framework - The koi under the pointer, or `null` over open water.
   */
  setHovered(framework: KoiFramework | null): void
}

/**
 * Builds the roster and wires focus to the host's hover notices.
 *
 * @param root - The pond root the roster is placed in.
 * @param url - Resolves a koi's app URL.
 * @param onFocus - Invoked with the koi a keyboard visitor moved onto, or `null` on blur.
 * @returns The roster.
 *
 * @example Publishing hover identity to the keyboard
 * ```typescript
 * const roster = createRoster(stage.root, fishHomeUrl, (framework) => setHover(framework))
 * roster.setConnected('lit', true)
 * ```
 */
export function createRoster(
  root: HTMLElement,
  url: (framework: KoiFramework) => string,
  onFocus: (framework: KoiFramework | null) => void
): KoiRoster {
  const section = document.createElement('nav')
  section.className = 'koi-roster'
  section.setAttribute('aria-label', 'Koi in this pond')

  // why: The roster is chrome floating over the water — a press on the panel must read the panel, never strike the pond showing behind it.
  const contain = (event: Event): void => {
    event.stopPropagation()
  }
  section.addEventListener('pointerdown', contain)
  section.addEventListener('click', contain)

  const heading = document.createElement('h2')
  heading.className = 'koi-roster-heading'
  heading.textContent = 'Koi in this pond'
  section.append(heading)

  const list = document.createElement('ul')
  section.append(list)

  const rows = new Map<KoiFramework, HTMLLIElement>()
  for (const framework of KOI_FRAMEWORKS) {
    const row = document.createElement('li')
    const link = document.createElement('a')
    link.href = url(framework)
    link.textContent = koiLabel(framework)
    link.dataset['fish'] = framework
    // why: Focus is the keyboard's hover — the same notice a pointer would trigger goes to the same fish, and the fish draws its own identity.
    link.addEventListener('focus', () => {
      onFocus(framework)
    })
    link.addEventListener('blur', () => {
      onFocus(null)
    })
    row.append(link)
    row.dataset['connected'] = 'false'
    list.append(row)
    rows.set(framework, row)
  }

  // note: The whole demo exists to be read — the roster carries the one link out to the code that builds it.
  const source = document.createElement('a')
  source.className = 'koi-roster-source'
  source.href = SOURCE_URL
  source.target = '_blank'
  source.rel = 'noopener noreferrer'
  source.textContent = 'Source on GitHub ↗'
  section.append(source)

  root.append(section)

  return {
    element: section,
    setConnected(framework, connected) {
      const row = rows.get(framework)
      if (row === undefined) {
        return
      }
      row.dataset['connected'] = connected ? 'true' : 'false'
      const link = row.querySelector('a')
      // why: A koi that never connected is not in the scene, so it is taken out of the tab order rather than offered as a dead target.
      if (link !== null) {
        link.tabIndex = connected ? 0 : -1
      }
    },
    setHovered(framework) {
      for (const [key, row] of rows) {
        row.dataset['hovered'] = key === framework ? 'true' : 'false'
      }
    },
  }
}
