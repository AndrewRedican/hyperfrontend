/**
 * How many viewport heights a page has to run to before a control that
 * returns the reader to the top is worth showing at all.
 *
 * A page that is one screen and a bit is scrolled back in a flick, and a
 * control for it is a control for nothing. Two screens is where the way
 * back stops being a flick, and measuring in screens rather than pixels
 * means the same document qualifies on a phone, where it is taller, exactly
 * when it qualifies on a desktop: when it is genuinely long to read.
 */
export const QUALIFYING_SCREENS = 2

/**
 * How many viewport heights the reader has to have descended before the
 * control appears on a page that qualifies.
 *
 * Nearly two screens down, the top is out of reach of a flick and the
 * reader has committed to the document; before that the control is noise
 * at the edge of a page that was just opened.
 */
export const REVEAL_SCREENS = 1.75

/** What the control needs to know at any moment. */
export interface ScrollToTopState {
  /** Whether the page is long enough for the control to exist at all */
  qualifies: boolean
  /** Whether the reader is far enough down for it to be shown */
  visible: boolean
}

/**
 * Whether a document is long enough to deserve a way back to the top.
 *
 * @param scrollHeight - The document's full height
 * @param viewportHeight - The height of the window it is read in
 * @returns True when the document runs to at least {@link QUALIFYING_SCREENS} screens
 *
 * @example A page just over one screen does not qualify; a long one does
 * ```typescript
 * qualifiesForScrollToTop(1300, 900) // false
 * qualifiesForScrollToTop(4000, 900) // true
 * ```
 */
export function qualifiesForScrollToTop(scrollHeight: number, viewportHeight: number): boolean {
  return viewportHeight > 0 && scrollHeight >= viewportHeight * QUALIFYING_SCREENS
}

/**
 * Whether the reader has descended far enough for the control to be shown.
 *
 * @param scrollY - How far the window is scrolled
 * @param viewportHeight - The height of the window
 * @returns True past {@link REVEAL_SCREENS} screens of descent
 *
 * @example
 * ```typescript
 * shouldRevealScrollToTop(900, 900) // false
 * shouldRevealScrollToTop(1600, 900) // true
 * ```
 */
export function shouldRevealScrollToTop(scrollY: number, viewportHeight: number): boolean {
  return viewportHeight > 0 && scrollY >= viewportHeight * REVEAL_SCREENS
}

/**
 * Read the control's state off a window.
 *
 * @param view - The window to measure
 * @returns Whether the page qualifies and whether the control is shown
 *
 * @example
 * ```typescript
 * readScrollToTopState(window) // { qualifies: true, visible: false }
 * ```
 */
export function readScrollToTopState(view: Window): ScrollToTopState {
  const qualifies = qualifiesForScrollToTop(view.document.documentElement.scrollHeight, view.innerHeight)
  return { qualifies, visible: qualifies && shouldRevealScrollToTop(view.scrollY, view.innerHeight) }
}

/**
 * Keep a listener told whether the control should exist and be shown.
 *
 * Work happens only while the page moves or changes size: the listener is
 * coalesced into one animation frame, and a frame that finds the state
 * unchanged tells nobody. The body is observed as well as the window,
 * because a page grows after it is first painted, as diagrams draw and a
 * reference expands, and whether it qualifies is measured against a height
 * that has just changed.
 *
 * @param view - The window to observe
 * @param onChange - Called with the new state whenever it changes, and once at the start
 * @returns A function that stops observing
 *
 * @example
 * ```typescript
 * useEffect(() => trackScrollToTop(window, setState), [])
 * ```
 */
export function trackScrollToTop(view: Window, onChange: (state: ScrollToTopState) => void): () => void {
  let frame = 0
  let published: ScrollToTopState | null = null

  const publish = (): void => {
    frame = 0
    const next = readScrollToTopState(view)
    if (published !== null && published.qualifies === next.qualifies && published.visible === next.visible) return
    published = next
    onChange(next)
  }

  const schedule = (): void => {
    if (frame === 0) frame = view.requestAnimationFrame(publish)
  }

  publish()
  view.addEventListener('scroll', schedule, { passive: true })
  view.addEventListener('resize', schedule, { passive: true })
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
  observer?.observe(view.document.body)

  return () => {
    view.removeEventListener('scroll', schedule)
    view.removeEventListener('resize', schedule)
    observer?.disconnect()
    if (frame !== 0) view.cancelAnimationFrame(frame)
  }
}
