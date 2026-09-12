'use client'

import type { ScrollToTopState } from '@/lib/scroll-to-top'
import { GA_MEASUREMENT_ID } from '@/lib/analytics'
import { consentStore } from '@/lib/consent/consent'
import { trackScrollToTop } from '@/lib/scroll-to-top'
import { useCallback, useEffect, useState } from 'react'

/**
 * A way back to the top of a long document.
 *
 * It exists only on a page that is genuinely long, two screens or more,
 * and appears only once the reader is most of two screens down it, so a
 * short page never grows a control for nothing and a long one is not
 * decorated with it before the reader has gone anywhere. Both are measured
 * against the window rather than in pixels, so the same document qualifies
 * on a phone, where it is taller, exactly when it would on a desktop.
 *
 * It sits in the corner every floating control on this site sits in, below
 * the header in the stacking ladder and out of the way while the consent
 * banner holds the bottom of the screen. Activating it scrolls the window
 * to the top, smoothly unless the reader has asked for less motion, and
 * hands focus to the page's content so a keyboard reader lands where the
 * eye does.
 * @returns The control, or nothing on a page that does not qualify.
 * @example Rendered once by the shell every long-form page is read in
 * ```tsx
 * <ScrollToTop />
 * ```
 */
export function ScrollToTop() {
  const [state, setState] = useState<ScrollToTopState>({ qualifies: false, visible: false })
  const [bannerUp, setBannerUp] = useState(false)

  useEffect(() => trackScrollToTop(window, setState), [])

  // why: the consent banner holds the bottom of the screen until a choice is made, and a control tucked behind it is a control nobody can reach
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return
    const sync = (): void => setBannerUp(!consentStore.hasDecision())
    sync()
    return consentStore.subscribe(sync)
  }, [])

  const scrollToTop = useCallback(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    const main = document.getElementById('main-content')
    if (main !== null) {
      main.tabIndex = -1
      main.focus({ preventScroll: true })
    }
  }, [])

  if (!state.qualifies) return null

  const shown = state.visible && !bannerUp

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="scroll-to-top"
      data-visible={shown ? 'true' : 'false'}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      aria-label="Scroll to top"
    >
      <span className="scroll-to-top__label" aria-hidden="true">
        <span>Scroll to top</span>
      </span>
      <span className="scroll-to-top__chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 14.5 6-6 6 6" />
        </svg>
      </span>
    </button>
  )
}
