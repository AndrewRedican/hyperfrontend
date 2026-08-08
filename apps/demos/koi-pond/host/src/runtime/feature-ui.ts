/**
 * Presentation-aware UI state for the feature, fed exclusively by the host
 * protocol: the SDK's `presentation` announcement carries the display mode,
 * and the session's `close` clears it. The app therefore never guesses its
 * runtime from URLs, query params, or `window.parent` — opened directly in a
 * tab nothing ever announces, the mode stays `null`, and dialog-only chrome
 * simply never renders.
 */

/** Display modes a host can announce; `null` means no host has presented the feature. */
export type FeatureDisplayMode = 'embedded' | 'dialog' | 'popup' | 'standalone'

/** The slice of the feature handle the UI state needs. */
export interface FeatureUiLink {
  /** Subscribes to a lifecycle or contract event. */
  on(event: string, handler: (data: unknown) => void): unknown
  /** Sends a contract event to the host. */
  send(type: string, data?: unknown): void
}

/** Presentation-fed UI state: the announced display mode plus the dialog close-request path. */
export interface FeatureUi {
  /** Binds the state to a live feature handle (or a test double). */
  attach(link: FeatureUiLink): void
  /** The mode the host announced, or `null` before any announcement and after close. */
  getMode(): FeatureDisplayMode | null
  /**
   * Subscribes to mode changes.
   *
   * @param listener - Invoked after every change.
   * @returns A function that removes the subscription.
   */
  subscribe(listener: () => void): () => void
  /**
   * Emits one `close-request` to the host. Only meaningful in dialog mode, and
   * latched until the presentation changes so a click racing a keyboard close
   * can never produce duplicate requests.
   *
   * @returns `true` when the request was sent, `false` when ignored.
   */
  requestClose(): boolean
}

const MODES: readonly FeatureDisplayMode[] = ['embedded', 'dialog', 'popup', 'standalone']

/**
 * Narrows an announced payload to a known display mode.
 *
 * @param data - The `presentation` payload.
 * @returns The mode, or `null` when unrecognized.
 */
function readMode(data: unknown): FeatureDisplayMode | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const mode = (<Record<string, unknown>>data)['mode']
  return typeof mode === 'string' && (<readonly string[]>MODES).includes(mode) ? <FeatureDisplayMode>mode : null
}

/**
 * Creates the presentation-fed UI state.
 *
 * @returns The {@link FeatureUi} handle.
 *
 * @example Wiring the live feature and rendering dialog chrome
 * ```typescript
 * const ui = createFeatureUi()
 * ui.attach(feature)
 * ui.subscribe(() => render(ui.getMode()))
 * closeButton.onclick = () => ui.requestClose()
 * ```
 */
export function createFeatureUi(): FeatureUi {
  let mode: FeatureDisplayMode | null = null
  let send: ((type: string, data?: unknown) => void) | null = null
  let closeRequested = false
  const listeners = new Set<() => void>()

  const apply = (next: FeatureDisplayMode | null): void => {
    // why: Every fresh presentation re-arms the close latch — a reopened dialog must be closable again.
    closeRequested = false
    if (mode === next) {
      return
    }
    mode = next
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    attach(link) {
      send = (type, data) => link.send(type, data)
      link.on('presentation', (data) => {
        apply(readMode(data))
      })
      link.on('close', () => {
        apply(null)
      })
    },
    getMode: () => mode,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    requestClose() {
      if (mode !== 'dialog' || closeRequested || send === null) {
        return false
      }
      closeRequested = true
      send('close-request', { source: 'button' })
      return true
    },
  }
}
